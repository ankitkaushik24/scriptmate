import {
  ScriptArgumentDefinition,
  ScriptDefinition,
  commandDisplayLabel,
} from "./command-definitions";

/** Safe POSIX shell alias identifier. */
export const SHELL_ALIAS_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function normalizeArgumentDefinition(
  raw: ScriptArgumentDefinition
): ScriptArgumentDefinition {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const type: "string" | "boolean" =
    raw.type === "boolean" ? "boolean" : "string";
  const out: ScriptArgumentDefinition = {
    name,
    type,
    required: Boolean(raw.required),
  };
  const desc = raw.description?.trim();
  if (desc) {
    out.description = desc;
  }
  if (raw.defaultValue !== undefined) {
    out.defaultValue = raw.defaultValue;
  }
  if (raw.isPositional) {
    out.isPositional = true;
  }
  return out;
}

export function normalizeScriptDefinition(raw: ScriptDefinition): ScriptDefinition {
  const args = (Array.isArray(raw.args) ? raw.args : []).map(
    normalizeArgumentDefinition
  );
  const baseTrim = raw.baseDirectory?.trim() ?? "";
  const aliasTrim = raw.shellAlias?.trim() ?? "";
  const labelTrim = raw.label?.trim() ?? "";

  const result: ScriptDefinition = {
    id: raw.id,
    command: raw.command.trim(),
    args,
  };
  if (labelTrim) {
    result.label = labelTrim;
  }

  const desc = raw.description?.trim();
  if (desc) {
    result.description = desc;
  }
  if (baseTrim) {
    result.baseDirectory = baseTrim;
  }
  if (aliasTrim) {
    result.shellAlias = aliasTrim;
  }

  return result;
}

/**
 * Returns an error message if the script cannot be persisted, or null if OK.
 * `allCommands` should reflect the store state before applying this add/update.
 */
export function validateScriptDefinitionForPersistence(
  script: ScriptDefinition,
  allCommands: ScriptDefinition[]
): string | null {
  if (script.shellAlias) {
    if (!SHELL_ALIAS_PATTERN.test(script.shellAlias)) {
      return "Shell alias must be a valid identifier (letters, digits, underscore; cannot start with a digit).";
    }
    const conflict = allCommands.find((c) => {
      if (c.id === script.id) {
        return false;
      }
      const other = c.shellAlias?.trim();
      return Boolean(other && other === script.shellAlias);
    });
    if (conflict) {
      return `Shell alias "${script.shellAlias}" is already used by "${commandDisplayLabel(
        conflict
      )}".`;
    }
  }
  return null;
}
