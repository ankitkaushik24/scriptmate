import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ScriptDefinition } from "./command-definitions";

const GLOBAL_RC_CACHE_KEY = "scriptmate.shellRcPath";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function markerStart(name: string): string {
  return `# scriptmate-alias-start ${name}`;
}

export function markerEnd(name: string): string {
  return `# scriptmate-alias-end ${name}`;
}

/** Bash single-quoted literal wrapping `value` (POSIX-safe for embedding). */
export function bashSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

/** Shell function body (bash/zsh): readable, forwards "$@", minimal quoting (cwd line only). */
function buildShellFunctionBlock(
  fnName: string,
  script: ScriptDefinition,
): string {
  const cwd = script.baseDirectory?.trim();
  const cmd = script.command.trim();
  const lines: string[] = [`${fnName}() {`];
  if (cwd !== undefined) {
    lines.push(`  cd ${bashSingleQuoted(cwd)} || return 1`);
  }
  lines.push(`  ${cmd} "$@"`);
  lines.push(`}`);
  return lines.join("\n");
}

function stripManagedBlock(content: string, aliasName: string): string {
  const startLine = markerStart(aliasName);
  const endLine = markerEnd(aliasName);
  const startIdx = content.indexOf(startLine);
  if (startIdx === -1) {
    return content;
  }
  const endIdx = content.indexOf(endLine, startIdx);
  if (endIdx === -1) {
    return content;
  }
  const afterEnd = endIdx + endLine.length;
  const before = content.slice(0, startIdx);
  let after = content.slice(afterEnd);
  if (after.startsWith("\n")) {
    after = after.slice(1);
  }
  return before + after;
}

function upsertManagedBlock(
  content: string,
  aliasName: string,
  managedBody: string,
): string {
  const stripped = stripManagedBlock(content, aliasName).trimEnd();
  const block = `${markerStart(aliasName)}\n${managedBody}\n${markerEnd(aliasName)}\n`;
  if (!stripped) {
    return block;
  }
  return `${stripped}\n\n${block}`;
}

async function pickRcPathInteraction(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".zshrc"),
    path.join(home, ".bashrc"),
    path.join(home, ".profile"),
  ];
  const picked = await vscode.window.showQuickPick(
    candidates.map((p) => ({ label: p })),
    {
      placeHolder:
        "Which shell profile should ScriptMate update for shell aliases?",
      ignoreFocusOut: true,
    },
  );
  if (!picked) {
    return undefined;
  }
  await context.globalState.update(GLOBAL_RC_CACHE_KEY, picked.label);
  return picked.label;
}

/**
 * Resolves the rc file to edit. Uses $SHELL when it maps to ~/.zshrc or ~/.bashrc;
 * otherwise prompts once and remembers the choice in global state.
 */
export async function resolveShellRcPath(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const cached = context.globalState.get<string>(GLOBAL_RC_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const shell = process.env.SHELL || "";
  const base = path.basename(shell).toLowerCase();
  const home = os.homedir();

  let guessed: string | undefined;
  if (base.includes("zsh")) {
    guessed = path.join(home, ".zshrc");
  } else if (base.includes("bash")) {
    guessed = path.join(home, ".bashrc");
  }

  if (guessed) {
    await context.globalState.update(GLOBAL_RC_CACHE_KEY, guessed);
    return guessed;
  }

  return pickRcPathInteraction(context);
}

async function writeRcIfChanged(
  rcPath: string,
  newContent: string,
): Promise<void> {
  let previous = "";
  if (fs.existsSync(rcPath)) {
    previous = fs.readFileSync(rcPath, "utf-8");
  }
  if (previous === newContent) {
    return;
  }
  const dir = path.dirname(rcPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const existed = fs.existsSync(rcPath);
  fs.writeFileSync(rcPath, newContent, "utf-8");
  if (!existed) {
    vscode.window.showInformationMessage(
      `ScriptMate created ${rcPath} for ScriptMate shell aliases. Restart the terminal or run source ${path.basename(rcPath)}.`,
    );
  }
}

export async function removeManagedShellAlias(
  context: vscode.ExtensionContext,
  aliasName: string,
): Promise<void> {
  const rcPath = await resolveShellRcPath(context);
  if (!rcPath || !fs.existsSync(rcPath)) {
    return;
  }
  const content = fs.readFileSync(rcPath, "utf-8");
  const next = stripManagedBlock(content, aliasName).trimEnd();
  const normalized = next.length > 0 ? `${next}\n` : "";
  await writeRcIfChanged(rcPath, normalized);
}

/** True when `aliasName` appears as a manual alias/function outside ScriptMate markers. */
export function hasManualShellAliasConflict(
  rcContent: string,
  aliasName: string,
): boolean {
  const strippedContent = stripManagedBlock(rcContent, aliasName);
  const escapedName = escapeRegex(aliasName);
  const aliasRegex = new RegExp(`^\\s*alias\\s+${escapedName}\\s*=`, "m");
  const funcRegex1 = new RegExp(`^\\s*${escapedName}\\s*\\(\\s*\\)`, "m");
  const funcRegex2 = new RegExp(`^\\s*function\\s+${escapedName}\\b`, "m");

  return (
    aliasRegex.test(strippedContent) ||
    funcRegex1.test(strippedContent) ||
    funcRegex2.test(strippedContent)
  );
}

export function manualShellAliasConflictMessage(
  aliasName: string,
  rcPath: string,
): string {
  return `The alias or function '${aliasName}' is already manually defined in ${path.basename(rcPath)}. Please remove it or choose a different alias name`;
}

/**
 * Returns an error message if the alias cannot be written to the shell profile, or null if OK.
 */
export async function validateShellAliasForRc(
  context: vscode.ExtensionContext,
  aliasName: string,
): Promise<string | null> {
  const trimmed = aliasName.trim();
  if (!trimmed) {
    return null;
  }

  const rcPath = await resolveShellRcPath(context);
  if (!rcPath) {
    return null;
  }

  let content = "";
  if (fs.existsSync(rcPath)) {
    content = fs.readFileSync(rcPath, "utf-8");
  }

  if (hasManualShellAliasConflict(content, trimmed)) {
    return manualShellAliasConflictMessage(trimmed, rcPath);
  }

  return null;
}

export async function upsertManagedShellAlias(
  context: vscode.ExtensionContext,
  aliasName: string,
  script: ScriptDefinition,
): Promise<void> {
  const rcPath = await resolveShellRcPath(context);
  if (!rcPath) {
    vscode.window.showWarningMessage(
      "ScriptMate: No shell profile selected; shell function was not written.",
    );
    return;
  }
  const fnBlock = buildShellFunctionBlock(aliasName, script);
  let content = "";
  if (fs.existsSync(rcPath)) {
    content = fs.readFileSync(rcPath, "utf-8");
  }

  if (hasManualShellAliasConflict(content, aliasName)) {
    throw new Error(manualShellAliasConflictMessage(aliasName, rcPath));
  }

  const next = upsertManagedBlock(content, aliasName, fnBlock);
  await writeRcIfChanged(rcPath, next);
}

/**
 * After commands JSON was saved: drop the previous managed block if the name changed
 * or the command was deleted; add/update the next shell function if present.
 */
export async function syncShellAliasTransition(
  context: vscode.ExtensionContext,
  previous: ScriptDefinition | undefined,
  next: ScriptDefinition | undefined,
): Promise<void> {
  const prevName = previous?.shellAlias?.trim();
  const nextName = next?.shellAlias?.trim();

  try {
    if (nextName && next) {
      await upsertManagedShellAlias(context, nextName, next);
    }
    if (prevName && prevName !== nextName) {
      await removeManagedShellAlias(context, prevName);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not update shell profile: ${msg}`);
  }
}

const MANAGED_ALIAS_START_PATTERN = /^# scriptmate-alias-start (.+)$/gm;

/** Names of all ScriptMate-managed alias blocks in the resolved shell rc file. */
export function listManagedShellAliasNames(rcPath: string): string[] {
  if (!fs.existsSync(rcPath)) {
    return [];
  }
  const content = fs.readFileSync(rcPath, "utf-8");
  const names: string[] = [];
  for (const match of content.matchAll(MANAGED_ALIAS_START_PATTERN)) {
    const name = match[1]?.trim();
    if (name) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Reconcile the shell profile with the current commands list: remove managed blocks
 * that no longer have a matching shellAlias, and upsert blocks for each alias in use.
 */
export async function syncAllShellAliases(
  context: vscode.ExtensionContext,
  commands: ScriptDefinition[],
): Promise<void> {
  const rcPath = await resolveShellRcPath(context);
  if (!rcPath) {
    vscode.window.showWarningMessage(
      "ScriptMate: No shell profile selected; shell aliases were not updated.",
    );
    return;
  }

  const desiredByName = new Map<string, ScriptDefinition>();
  for (const cmd of commands) {
    const name = cmd.shellAlias?.trim();
    if (name) {
      desiredByName.set(name, cmd);
    }
  }

  try {
    const managedNames = listManagedShellAliasNames(rcPath);
    for (const name of managedNames) {
      if (!desiredByName.has(name)) {
        await removeManagedShellAlias(context, name);
      }
    }
    for (const [name, script] of desiredByName) {
      await upsertManagedShellAlias(context, name, script);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not sync shell profile: ${msg}`);
  }
}
