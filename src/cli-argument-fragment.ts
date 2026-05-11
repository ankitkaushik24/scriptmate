/**
 * Pure CLI fragment formatting for script arguments.
 * Used by the extension at execution time and by the modal webview for previews.
 * Must stay in sync with terminal behavior.
 */
export interface CliArgumentFormatInput {
  name: string;
  type: "string" | "boolean";
  isPositional?: boolean;
}

/**
 * Fragment this argument adds to the command (leading space when non-empty).
 */
export function formatArgumentFragment(
  argDef: CliArgumentFormatInput,
  value: string | boolean | undefined,
): string {
  if (value === undefined) {
    return "";
  }
  if (argDef.isPositional && argDef.type === "string") {
    if (value !== "") {
      return ` "${value}"`;
    }
    return "";
  }
  if (argDef.type === "boolean") {
    if (value === true) {
      const prefix = argDef.name.length === 1 ? "-" : "--";
      return ` ${prefix}${argDef.name}`;
    }
    return "";
  }
  if (value !== "") {
    return ` --${argDef.name} "${value}"`;
  }
  return "";
}

export function buildArgumentsSuffix(
  argDefs: CliArgumentFormatInput[],
  valuesByName: { [key: string]: string | boolean },
): string {
  let cmdStr = "";
  for (const argDef of argDefs) {
    cmdStr += formatArgumentFragment(argDef, valuesByName[argDef.name]);
  }
  return cmdStr;
}
