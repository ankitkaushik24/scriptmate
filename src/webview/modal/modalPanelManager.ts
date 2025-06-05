import * as vscode from "vscode";
import * as crypto from "crypto";
import { CommandStore } from "../../command-store";
import { ScriptDefinition } from "../../command-definitions";
import { getHtmlForModalWebview } from "./getHtmlFormModalWebview";

export class ModalPanelManager {
  private panel: vscode.WebviewPanel | undefined = undefined;
  private readonly context: vscode.ExtensionContext;
  private readonly commandStore: CommandStore;

  constructor(context: vscode.ExtensionContext, commandStore: CommandStore) {
    this.context = context;
    this.commandStore = commandStore;
  }

  public createOrShowModal(commandToEdit?: ScriptDefinition) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const isNewCommand = !commandToEdit;
    const globalBaseDirectory = vscode.workspace
      .getConfiguration("scriptmate")
      .get<string>("baseDirectory");

    const commandDataForModal: ScriptDefinition = commandToEdit
      ? { baseDirectory: globalBaseDirectory, ...commandToEdit }
      : ({
          id: crypto.randomUUID(),
          label: "",
          command: "",
          baseDirectory: globalBaseDirectory || "",
          args: [],
        } as ScriptDefinition);

    if (this.panel) {
      this.panel.reveal(column);
      this.panel.webview.postMessage({
        type: "initialData",
        payload: { command: commandDataForModal, isNew: isNewCommand },
      });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "scriptmate.editCommandModal",
      isNewCommand
        ? "Add New ScriptMate Script"
        : `Edit: ${commandDataForModal.label}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "node_modules",
            "@vscode",
            "codicons"
          ),
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "node_modules",
            "@vscode",
            "webview-ui-toolkit"
          ),
        ],
        // retainContextWhenHidden: true, // Optionally
      }
    );

    this.panel.webview.html = getHtmlForModalWebview(
      this.panel.webview,
      this.context,
      commandDataForModal,
      isNewCommand
    );

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "saveCommand":
            const scriptDef = message.payload as ScriptDefinition;
            try {
              if (commandToEdit && commandToEdit.id === scriptDef.id) {
                await this.commandStore.updateCommand(scriptDef);
                vscode.window.showInformationMessage(
                  `ScriptMate: Command "${scriptDef.label}" updated.`
                );
              } else if (
                this.commandStore
                  .getCommands()
                  .some((c) => c.id === scriptDef.id)
              ) {
                vscode.window.showErrorMessage(
                  `ScriptMate: Command with ID "${scriptDef.id}" already exists. Please choose a unique ID.`
                );
                this.panel?.webview.postMessage({
                  type: "saveError",
                  payload: { error: "ID_EXISTS", command: scriptDef },
                });
                return;
              } else if (commandToEdit && commandToEdit.id !== scriptDef.id) {
                await this.commandStore.deleteCommand(commandToEdit.id);
                await this.commandStore.addCommand(scriptDef);
                vscode.window.showInformationMessage(
                  `ScriptMate: Command "${commandToEdit.label}" updated to "${scriptDef.label}" with new ID.`
                );
              } else {
                await this.commandStore.addCommand(scriptDef);
                vscode.window.showInformationMessage(
                  `ScriptMate: Command "${scriptDef.label}" added.`
                );
              }
              this.panel?.dispose();
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to save command: ${error}`
              );
              this.panel?.webview.postMessage({
                type: "saveError",
                payload: { error: String(error), command: scriptDef },
              });
            }
            return;
          case "select-folder":
            const options: vscode.OpenDialogOptions = {
              canSelectMany: false,
              openLabel: "Select Base Directory",
              canSelectFolders: true,
              canSelectFiles: false,
            };

            vscode.window.showOpenDialog(options).then((fileUri) => {
              if (fileUri && fileUri[0]) {
                this.panel?.webview.postMessage({
                  type: "folder-selected",
                  path: fileUri[0].fsPath,
                });
              }
            });
            return;
          case "cancelModal":
            this.panel?.dispose();
            return;
          case "getInitialData":
            this.panel?.webview.postMessage({
              type: "initialData",
              payload: { command: commandDataForModal, isNew: isNewCommand },
            });
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );
  }
}
