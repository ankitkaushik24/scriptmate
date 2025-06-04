import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ScriptDefinition } from "./command-definitions";
import { CommandStore } from "./command-store";

const config = vscode.workspace.getConfiguration("scriptmate");

async function promptForArguments(
  context: vscode.ExtensionContext,
  commandDef: ScriptDefinition,
  currentArgValues: { [key: string]: string | boolean }
): Promise<void> {
  const baseDirectory = config.get<string>("baseDirectory");

  function buildCommandString(args: {
    [key: string]: string | boolean;
  }): string {
    let cmdStr = "";
    for (const argDef of commandDef.args) {
      const value = args[argDef.name];
      if (value !== undefined) {
        if (argDef.isPositional && argDef.type === "string") {
          if (value !== "") {
            cmdStr += ` \"${value}\"`;
          }
        } else if (argDef.type === "boolean") {
          if (value === true) {
            cmdStr += ` --${argDef.name}`;
          }
        } else {
          if (value !== "") {
            cmdStr += ` --${argDef.name} \"${value}\"`;
          }
        }
      }
    }
    return cmdStr;
  }

  const finalArguments = buildCommandString(currentArgValues);
  const currentCommandPreview = `${commandDef.command}${finalArguments}`;
  const executionLocationInfo = baseDirectory
    ? `(Will run in: ${baseDirectory})`
    : "(Base directory not set! Command may fail.)";

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
    let description = argDef.description;
    if (
      argDef.defaultValue !== undefined &&
      currentValue === argDef.defaultValue
    ) {
      description += ` (default: ${
        argDef.type === "boolean"
          ? argDef.defaultValue
            ? "Yes"
            : "No"
          : `\"${argDef.defaultValue}\"`
      })`;
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
      "Review arguments or execute. Select an argument to modify it.",
    ignoreFocusOut: true,
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
      SCRIPTMATE_BASE_DIRECTORY: baseDirectory,
    };

    const terminalOptions: vscode.TerminalOptions = {
      name: path.basename(
        commandDef.command.split(" ")[0] || "scriptmate-script"
      ),
      cwd: baseDirectory,
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
      (arg) => arg.name === selectedItem.argName
    );
    if (!argToEdit) {
      return;
    }
    let newValue: string | boolean | undefined;
    if (argToEdit.type === "string") {
      const input = await vscode.window.showInputBox({
        prompt: argToEdit.prompt || `Enter new value for --${argToEdit.name}`,
        placeHolder: argToEdit.description,
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
          placeHolder: argToEdit.description || `Enable --${argToEdit.name}?`,
          ignoreFocusOut: true,
        }
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
          "Open Settings"
        );
        if (action === "Configure Custom Commands File") {
          vscode.commands.executeCommand(
            "scriptmate.showCustomCommandsManager"
          );
        } else if (action === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "scriptmate.customCommandsPath"
          );
        }
        return;
      }

      let selectedCommandDef: ScriptDefinition | undefined;

      if (commandId) {
        selectedCommandDef = availableCommands.find(
          (cmd: ScriptDefinition) => cmd.id === commandId
        );
        if (!selectedCommandDef) {
          vscode.window.showErrorMessage(
            `ScriptMate: Command with ID "${commandId}" not found.`
          );
          return;
        }
      } else {
        const commandOptions = availableCommands.map(
          (cmd: ScriptDefinition) => ({
            label: cmd.label,
            description: cmd.description,
            id: cmd.id,
          })
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
          (cmd: ScriptDefinition) => cmd.id === selectedCommandOption.id
        );
      }

      if (!selectedCommandDef) {
        vscode.window.showErrorMessage(
          "Selected script definition not found. It might have been removed."
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
        currentArgumentValues
      );
    }
  );
  context.subscriptions.push(executeRegisteredScriptDisposable);
}
