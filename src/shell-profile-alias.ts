import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ScriptDefinition } from "./command-definitions";

const GLOBAL_RC_CACHE_KEY = "scriptmate.shellRcPath";

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
        "Which shell profile should ScriptMate update for shell functions?",
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
      `ScriptMate created ${rcPath} for ScriptMate shell functions. Restart the terminal or run source ${path.basename(rcPath)}.`,
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
    if (prevName && prevName !== nextName) {
      await removeManagedShellAlias(context, prevName);
    }
    if (nextName && next) {
      await upsertManagedShellAlias(context, nextName, next);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(
      `ScriptMate: Could not update shell profile (${msg}).`,
    );
  }
}
