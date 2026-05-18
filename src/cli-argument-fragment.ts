/**
 * Pure CLI fragment formatting for script arguments.
 * Used by the extension at execution time and by the modal webview for previews.
 * Must stay in sync with terminal behavior.
 *
 * Positional `string` or `enum`: value only (no `name` prefix).
 * `quoteValue` (default `true`) controls whether the value is wrapped in double quotes.
 */
export interface CliArgumentFormatInput {
  name: string;
  type: "string" | "boolean" | "enum";
  isPositional?: boolean;
  /** When true, the value is emitted without surrounding quotes. Omit for default quoting. */
  unquoted?: boolean;
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
  if (argDef.type === "boolean") {
    if (value === true) {
      return ` ${argDef.name}`;
    }
    return "";
  }
  if (argDef.type === "string" || argDef.type === "enum") {
    if (value === "") {
      return "";
    }
    const formattedValue = argDef.unquoted ? String(value) : `"${value}"`;
    if (argDef.isPositional) {
      return ` ${formattedValue}`;
    }
    return ` ${argDef.name} ${formattedValue}`;
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
