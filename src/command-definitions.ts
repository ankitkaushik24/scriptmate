import * as vscode from "vscode"; // Keep vscode import if types are used here, otherwise remove

// --- Type Definitions for Command Structure ---
export interface ScriptArgumentDefinition {
  name: string; // e.g., "ticket" or "branch"
  description: string; // User-friendly description for the prompt
  type: "string" | "boolean";
  defaultValue?: string | boolean;
  required: boolean;
  prompt?: string; // Optional custom prompt message, defaults to "Enter value for [name]"
  isPositional?: boolean; // If true, the argument value is passed directly without its name
}

export interface ScriptDefinition {
  id: string; // Unique ID for the command
  label: string; // User-friendly label for the QuickPick
  command: string; // The full command to execute (e.g., "zx src/scripts/my-script.mjs", "sh src/scripts/another.sh")
  args: ScriptArgumentDefinition[];
  description?: string; // Optional description for the command in QuickPick
}

// --- Statically Defined Commands ---
export const registeredCommands: ScriptDefinition[] = [];
