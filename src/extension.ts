import * as vscode from "vscode";
import { registerScriptMateCommands } from "./command-handler";
import { CommandStore } from "./command-store";
import { CustomCommandsViewProvider } from "./custom-commands-view-provider";
import { ScriptDefinition } from "./command-definitions";
import { ModalPanelManager } from "./webview/modal/modalPanelManager";

export function activate(context: vscode.ExtensionContext) {
  console.log("ScriptMate extension is now active!");

  const commandStore = CommandStore.getInstance(context);
  commandStore.loadCommands();

  const modalPanelManager = new ModalPanelManager(context, commandStore);

  registerScriptMateCommands(context);

  const viewProvider = new CustomCommandsViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CustomCommandsViewProvider.viewType,
      viewProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "scriptmate.showCustomCommandsManager",
      () => {
        vscode.commands.executeCommand(
          "workbench.view.extension.scriptmate-activitybar"
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "scriptmate.internal.openEditModal",
      (commandToEdit?: ScriptDefinition) => {
        modalPanelManager.createOrShowModal(commandToEdit);
      }
    )
  );

  console.log("ScriptMate commands and view provider registered.");
}

export function deactivate() {}
