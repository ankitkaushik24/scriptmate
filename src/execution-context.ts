import * as vscode from "vscode";
import { ScriptDefinition } from "./command-definitions";

/**
 * Resolved cwd and SCRIPTMATE_BASE_DIRECTORY:
 * non-empty per-script baseDirectory, else first workspace folder, else unset.
 */
export function resolveScriptWorkingDirectory(
  commandDef: ScriptDefinition
): string | undefined {
  const trimmed = commandDef.baseDirectory?.trim();
  if (trimmed) {
    return trimmed;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}
