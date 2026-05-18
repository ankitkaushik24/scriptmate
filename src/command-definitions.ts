// --- Type Definitions for Command Structure ---
export interface ScriptArgumentDefinition {
  name: string; // e.g., "--ticket", "-f", or "branch" — emitted exactly as written
  /** Shown in prompts; if omitted, the argument name is used. */
  description?: string;
  type: "string" | "boolean" | "enum";
  /** Required when `type` is `"enum"`; labels shown in Quick Pick (trimmed, empty omitted). */
  options?: string[];
  defaultValue?: string | boolean;
  required: boolean;
  /**
   * When true for `string` or `enum`, only the quoted value is appended (no `name` prefix).
   * Not used for `boolean`.
   */
  isPositional?: boolean;
  /**
   * When true for `string` or `enum`, the value is appended without surrounding quotes,
   * enabling shell globbing and word splitting. Omit or leave false to keep default quoting.
   * Not used for `boolean`.
   */
  unquoted?: boolean;
}

export interface ScriptDefinition {
  id: string; // Unique ID for the command
  /** Shown in Quick Pick and UI; if omitted or blank, `command` is shown instead. */
  label?: string;
  command: string; // The full command to execute (e.g., "zx src/scripts/my-script.mjs", "sh src/scripts/another.sh")
  /** Working directory for this script; omit or leave blank to use the first workspace folder. */
  baseDirectory?: string;
  /** Optional shell alias name written to ~/.zshrc or ~/.bashrc on save (POSIX identifier). */
  shellAlias?: string;
  args: ScriptArgumentDefinition[];
  description?: string; // Optional description for the command in QuickPick
}

/** Primary title for UI / Quick Pick: custom label, or the command string if unset. */
export function commandDisplayLabel(script: ScriptDefinition): string {
  const trimmed = script.label?.trim();
  if (trimmed) {
    return trimmed;
  }
  return script.command.trim();
}

// --- Statically Defined Commands ---
export const registeredCommands: ScriptDefinition[] = [];
