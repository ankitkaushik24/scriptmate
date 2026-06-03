import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  ScriptDefinition,
  ScriptArgumentDefinition,
  commandDisplayLabel,
} from "./command-definitions";
import { CommandStore } from "./command-store";
import { buildArgumentsSuffix } from "./cli-argument-fragment";
import { resolveScriptWorkingDirectory } from "./execution-context";

function isUnsetString(value: string | boolean | undefined): boolean {
  return value === undefined || value === "";
}

function requiredArgumentUnsatisfied(
  argDef: ScriptArgumentDefinition,
  currentArgValues: { [key: string]: string | boolean },
): boolean {
  if (!argDef.required) {
    return false;
  }
  const v = currentArgValues[argDef.name];
  if (argDef.type === "boolean") {
    return false;
  }
  if (argDef.type === "enum") {
    const opts = argDef.options ?? [];
    if (v === undefined || v === "") {
      return argDef.isPositional || argDef.defaultValue === undefined;
    }
    if (typeof v !== "string") {
      return true;
    }
    return !opts.includes(v);
  }
  // string
  if (argDef.isPositional) {
    return isUnsetString(v);
  }
  return isUnsetString(v) && argDef.defaultValue === undefined;
}

const ADDITIONAL_PARAMS_LABEL = "Additional params";

const COPY_COMMAND_PREVIEW_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon("copy"),
  tooltip: "Copy command preview",
};

async function promptForArguments(
  context: vscode.ExtensionContext,
  commandDef: ScriptDefinition,
  currentArgValues: { [key: string]: string | boolean },
  additionalParams: string = "",
): Promise<void> {
  const resolvedCwd = resolveScriptWorkingDirectory(commandDef);
  const trimmedCustom = commandDef.baseDirectory?.trim();

  const finalArguments = buildArgumentsSuffix(
    commandDef.args,
    currentArgValues,
  );
  const additionalParamsSuffix = additionalParams ? ` ${additionalParams}` : "";
  const currentCommandPreview = `${commandDef.command}${finalArguments}${additionalParamsSuffix}`;
  const executionLocationInfo = trimmedCustom
    ? `(Will run in custom directory: ${trimmedCustom})`
    : resolvedCwd
      ? `(Will run in workspace folder: ${resolvedCwd})`
      : "(No workspace folder open — terminal uses VS Code default cwd)";

  const quickPickItems: (vscode.QuickPickItem & {
    action?: "execute" | "edit" | "editExtra";
    argName?: string;
  })[] = [];

  quickPickItems.push({
    label: `Execute Script`,
    detail: currentCommandPreview,
    description: executionLocationInfo,
    action: "execute",
    buttons: [COPY_COMMAND_PREVIEW_BUTTON],
  });

  for (const argDef of commandDef.args) {
    const currentValue = currentArgValues[argDef.name];
    let displayValue = "";
    if (currentValue !== undefined) {
      displayValue =
        argDef.type === "boolean"
          ? currentValue
            ? "Yes"
            : "No"
          : `\"${String(currentValue)}\"`;
    } else {
      displayValue =
        argDef.type === "string" || argDef.type === "enum"
          ? "(not set)"
          : "(No)";
    }
    let description = (argDef.description ?? "").trim();
    if (
      argDef.defaultValue !== undefined &&
      currentValue === argDef.defaultValue
    ) {
      const defaultBit = ` (default: ${
        argDef.type === "boolean"
          ? argDef.defaultValue
            ? "Yes"
            : "No"
          : `\"${String(argDef.defaultValue)}\"`
      })`;
      description = description ? `${description}${defaultBit}` : defaultBit;
    }
    quickPickItems.push({
      label: `${argDef.name}`,
      description: `${displayValue}`,
      detail: description,
      action: "edit",
      argName: argDef.name,
    });
  }

  quickPickItems.push({
    label: ADDITIONAL_PARAMS_LABEL,
    description: additionalParams || "(none)",
    detail: "Raw flags or values to append as is",
    action: "editExtra",
  });

  type QuickPickItemType = (typeof quickPickItems)[number];
  const selectedItem = await new Promise<QuickPickItemType | undefined>(
    (resolve) => {
      const qp = vscode.window.createQuickPick<QuickPickItemType>();
      qp.items = quickPickItems;
      qp.placeholder =
        "Review cwd (workspace vs custom path), arguments, then execute or edit an argument.";
      qp.ignoreFocusOut = false;

      let resolved = false;

      qp.onDidAccept(() => {
        if (!resolved) {
          resolved = true;
          resolve(qp.selectedItems[0]);
          qp.hide();
        }
      });

      qp.onDidHide(() => {
        if (!resolved) {
          resolved = true;
          resolve(undefined);
        }
        qp.dispose();
      });

      qp.onDidTriggerItemButton(async ({ item, button }) => {
        if (
          item.action === "execute" &&
          button === COPY_COMMAND_PREVIEW_BUTTON
        ) {
          await vscode.env.clipboard.writeText(currentCommandPreview);
          vscode.window.showInformationMessage(
            "ScriptMate: Copied command to clipboard.",
          );
        }
      });

      qp.show();
    },
  );

  if (!selectedItem) {
    vscode.window.showInformationMessage("Script execution cancelled.");
    return;
  }

  if (selectedItem.action === "execute") {
    const missing = commandDef.args.filter((a) =>
      requiredArgumentUnsatisfied(a, currentArgValues),
    );
    if (missing.length > 0) {
      const labels = missing.map((a) => a.name).join(", ");
      await vscode.window.showWarningMessage(
        `ScriptMate: Set all required arguments before running (${labels}).`,
      );
      return promptForArguments(
        context,
        commandDef,
        currentArgValues,
        additionalParams,
      );
    }

    for (const argDef of commandDef.args) {
      if (argDef.type !== "enum") {
        continue;
      }
      const opts = argDef.options ?? [];
      if (opts.length === 0) {
        continue;
      }
      const v = currentArgValues[argDef.name];
      if (typeof v === "string" && v !== "" && !opts.includes(v)) {
        await vscode.window.showWarningMessage(
          `ScriptMate: "${argDef.name}" is not a valid enum choice; pick a listed value.`,
        );
        return promptForArguments(
          context,
          commandDef,
          currentArgValues,
          additionalParams,
        );
      }
    }

    const userGlobalEnv = vscode.workspace
      .getConfiguration("scriptmate")
      .get<{ [key: string]: string }>("globalEnv");

    const newEnv: { [key: string]: string | undefined } = {
      ...process.env,
      ...userGlobalEnv,
    };
    if (resolvedCwd !== undefined) {
      newEnv.SCRIPTMATE_BASE_DIRECTORY = resolvedCwd;
    }

    const terminalOptions: vscode.TerminalOptions = {
      name: path.basename(
        commandDef.command.split(" ")[0] || "scriptmate-script",
      ),
      cwd: resolvedCwd,
      env: newEnv,
    };

    const terminal = vscode.window.createTerminal(terminalOptions);
    const commandToExecute = `${commandDef.command}${finalArguments}${additionalParamsSuffix}`;

    terminal.sendText(commandToExecute);
    terminal.show();
    return;
  }

  if (selectedItem.action === "editExtra") {
    const input = await vscode.window.showInputBox({
      prompt: "Enter additional parameters to append to the command",
      placeHolder: "e.g. --dry-run --verbose",
      value: additionalParams,
      ignoreFocusOut: true,
    });
    if (input === undefined) {
      return promptForArguments(
        context,
        commandDef,
        currentArgValues,
        additionalParams,
      );
    }
    return promptForArguments(
      context,
      commandDef,
      currentArgValues,
      input.trim(),
    );
  }

  if (selectedItem.action === "edit" && selectedItem.argName) {
    const argToEdit = commandDef.args.find(
      (arg) => arg.name === selectedItem.argName,
    );
    if (!argToEdit) {
      return;
    }
    let newValue: string | boolean | undefined;
    if (argToEdit.type === "string") {
      const input = await vscode.window.showInputBox({
        prompt: `Enter new value for ${argToEdit.name}`,
        placeHolder:
          argToEdit.description?.trim() || `Value for ${argToEdit.name}`,
        value:
          (currentArgValues[argToEdit.name] as string) ||
          (argToEdit.defaultValue as string) ||
          "",
        ignoreFocusOut: true,
        validateInput: (text) => {
          if (
            argToEdit.required &&
            !text &&
            argToEdit.defaultValue === undefined
          ) {
            return `${argToEdit.name} is required.`;
          }
          return null;
        },
      });
      if (input === undefined) {
        return promptForArguments(
          context,
          commandDef,
          currentArgValues,
          additionalParams,
        );
      }
      newValue = input;
    } else if (argToEdit.type === "boolean") {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "Yes", description: "Set flag to true", value: true },
          { label: "No", description: "Set flag to false", value: false },
        ],
        {
          placeHolder:
            argToEdit.description?.trim() || `Enable ${argToEdit.name}?`,
          ignoreFocusOut: true,
        },
      );
      if (choice === undefined) {
        return promptForArguments(
          context,
          commandDef,
          currentArgValues,
          additionalParams,
        );
      }
      newValue = choice.value;
    } else if (argToEdit.type === "enum") {
      const opts = argToEdit.options ?? [];
      if (opts.length === 0) {
        await vscode.window.showErrorMessage(
          `ScriptMate: Argument "${argToEdit.name}" has no enum options configured.`,
        );
        return promptForArguments(
          context,
          commandDef,
          currentArgValues,
          additionalParams,
        );
      }
      const currentStr =
        (currentArgValues[argToEdit.name] as string | undefined) ??
        (typeof argToEdit.defaultValue === "string"
          ? argToEdit.defaultValue
          : undefined);
      const choice = await vscode.window.showQuickPick(
        opts.map((label) => ({
          label,
          picked: label === currentStr,
        })),
        {
          placeHolder:
            argToEdit.description?.trim() ||
            `Choose a value for ${argToEdit.name}`,
          ignoreFocusOut: true,
        },
      );
      if (choice === undefined) {
        return promptForArguments(
          context,
          commandDef,
          currentArgValues,
          additionalParams,
        );
      }
      newValue = choice.label;
    }
    currentArgValues[argToEdit.name] = newValue!;
    return promptForArguments(
      context,
      commandDef,
      currentArgValues,
      additionalParams,
    );
  }
}

export function registerScriptMateCommands(context: vscode.ExtensionContext) {
  const commandStore = CommandStore.getInstance(context);

  const executeRegisteredScriptDisposable = vscode.commands.registerCommand(
    "scriptmate.executeRegisteredScript",
    async (commandId?: string) => {
      const availableCommands = commandStore.getCommands();

      if (availableCommands.length === 0) {
        const action = await vscode.window.showInformationMessage(
          "No ScriptMate commands found. You can define custom commands in a JSON file.",
          "Configure Custom Commands File",
          "Open Settings",
        );
        if (action === "Configure Custom Commands File") {
          vscode.commands
            .executeCommand("scriptmate.showCustomCommandsManager")
            .then(undefined, (err) => {
              console.error(err);
              vscode.window.showErrorMessage(
                `ScriptMate: Failed to open commands manager. ${err}`,
              );
            });
        } else if (action === "Open Settings") {
          vscode.commands
            .executeCommand(
              "workbench.action.openSettings",
              "scriptmate.customCommandsPath",
            )
            .then(undefined, (err) => {
              console.error(err);
              vscode.window.showErrorMessage(
                `ScriptMate: Failed to open settings. ${err}`,
              );
            });
        }
        return;
      }

      let selectedCommandDef: ScriptDefinition | undefined;

      if (commandId) {
        selectedCommandDef = availableCommands.find(
          (cmd: ScriptDefinition) => cmd.id === commandId,
        );
        if (!selectedCommandDef) {
          vscode.window.showErrorMessage(
            `ScriptMate: Command with ID "${commandId}" not found.`,
          );
          return;
        }
      } else {
        const commandOptions = availableCommands.map(
          (cmd: ScriptDefinition) => ({
            label: commandDisplayLabel(cmd),
            description: cmd.description,
            id: cmd.id,
          }),
        );

        const selectedCommandOption = await vscode.window.showQuickPick<
          vscode.QuickPickItem & { id: string }
        >(commandOptions, {
          placeHolder: "Select a ScriptMate script to execute",
          ignoreFocusOut: true,
        });

        if (!selectedCommandOption) {
          vscode.window.showInformationMessage("No script selected.");
          return;
        }

        selectedCommandDef = availableCommands.find(
          (cmd: ScriptDefinition) => cmd.id === selectedCommandOption.id,
        );
      }

      if (!selectedCommandDef) {
        vscode.window.showErrorMessage(
          "Selected script definition not found. It might have been removed.",
        );
        return;
      }

      const currentArgumentValues: { [key: string]: string | boolean } = {};
      for (const argDef of selectedCommandDef.args) {
        if (argDef.defaultValue !== undefined) {
          currentArgumentValues[argDef.name] = argDef.defaultValue;
        }
      }
      await promptForArguments(
        context,
        selectedCommandDef,
        currentArgumentValues,
      );
    },
  );
  context.subscriptions.push(executeRegisteredScriptDisposable);
}
