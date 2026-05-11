import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ScriptDefinition, commandDisplayLabel } from "./command-definitions";
import { CommandStore } from "./command-store";
import { buildArgumentsSuffix } from "./cli-argument-fragment";
import { resolveScriptWorkingDirectory } from "./execution-context";

async function promptForArguments(
  context: vscode.ExtensionContext,
  commandDef: ScriptDefinition,
  currentArgValues: { [key: string]: string | boolean },
): Promise<void> {
  const resolvedCwd = resolveScriptWorkingDirectory(commandDef);
  const trimmedCustom = commandDef.baseDirectory?.trim();

  const finalArguments = buildArgumentsSuffix(
    commandDef.args,
    currentArgValues,
  );
  const currentCommandPreview = `${commandDef.command}${finalArguments}`;
  const executionLocationInfo = trimmedCustom
    ? `(Will run in custom directory: ${trimmedCustom})`
    : resolvedCwd
      ? `(Will run in workspace folder: ${resolvedCwd})`
      : "(No workspace folder open — terminal uses VS Code default cwd)";

  const quickPickItems: (vscode.QuickPickItem & {
    action?: "execute" | "edit";
    argName?: string;
  })[] = [];

  quickPickItems.push({
    label: `Execute Script`,
    detail: currentCommandPreview,
    description: executionLocationInfo,
    action: "execute",
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
          : `\"${currentValue}\"`;
    } else {
      displayValue = argDef.type === "string" ? "(not set)" : "(No)";
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
          : `\"${argDef.defaultValue}\"`
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

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder:
      "Review cwd (workspace vs custom path), arguments, then execute or edit an argument.",
    ignoreFocusOut: false,
  });

  if (!selectedItem) {
    vscode.window.showInformationMessage("Script execution cancelled.");
    return;
  }

  if (selectedItem.action === "execute") {
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
    const commandToExecute = `${commandDef.command}${finalArguments}`;

    terminal.sendText(commandToExecute);
    terminal.show();
    return;
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
        prompt: `Enter new value for --${argToEdit.name}`,
        placeHolder:
          argToEdit.description?.trim() || `Value for --${argToEdit.name}`,
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
        return promptForArguments(context, commandDef, currentArgValues);
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
            argToEdit.description?.trim() || `Enable --${argToEdit.name}?`,
          ignoreFocusOut: true,
        },
      );
      if (choice === undefined) {
        return promptForArguments(context, commandDef, currentArgValues);
      }
      newValue = choice.value;
    }
    currentArgValues[argToEdit.name] = newValue!;
    return promptForArguments(context, commandDef, currentArgValues);
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
          vscode.commands.executeCommand(
            "scriptmate.showCustomCommandsManager",
          );
        } else if (action === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "scriptmate.customCommandsPath",
          );
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
