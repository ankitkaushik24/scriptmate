import * as vscode from "vscode";
import * as crypto from "crypto";
import { CommandStore } from "../../command-store";
import {
  ScriptDefinition,
  commandDisplayLabel,
} from "../../command-definitions";
import { getHtmlForModalWebview } from "./getHtmlFormModalWebview";

export class ModalPanelManager {
  private panel: vscode.WebviewPanel | undefined = undefined;
  private readonly context: vscode.ExtensionContext;
  private readonly commandStore: CommandStore;
  private currentCommandToEdit: ScriptDefinition | undefined = undefined;
  private currentCommandDataForModal: ScriptDefinition | undefined = undefined;
  private currentIsNewCommand: boolean = true;

  constructor(context: vscode.ExtensionContext, commandStore: CommandStore) {
    this.context = context;
    this.commandStore = commandStore;
  }

  public createOrShowModal(commandToEdit?: ScriptDefinition) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    this.currentCommandToEdit = commandToEdit;
    this.currentIsNewCommand = !commandToEdit;

    this.currentCommandDataForModal = commandToEdit
      ? { ...commandToEdit }
      : ({
          id: crypto.randomUUID(),
          command: "",
          baseDirectory: "",
          shellAlias: "",
          args: [],
        } as ScriptDefinition);

    if (this.panel) {
      this.panel.title = this.getModalTitle();
      this.panel.reveal(column);
      this.postInitialData(this.panel.webview);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "scriptmate.editCommandModal",
      this.getModalTitle(),
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "dist"),
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "node_modules",
            "@vscode",
            "codicons",
          ),
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
          ),
        ],
        // retainContextWhenHidden: true, // Optionally
      },
    );

    this.panel.webview.html = getHtmlForModalWebview(
      this.panel.webview,
      this.context,
      this.currentCommandDataForModal,
      this.currentIsNewCommand,
    );

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "saveCommand": {
            const scriptDefinition = message.payload as ScriptDefinition;
            await this.handleSaveCommand(scriptDefinition);
            return;
          }
          case "select-folder": {
            const openDialogOptions: vscode.OpenDialogOptions = {
              canSelectMany: false,
              openLabel: "Select Base Directory",
              canSelectFolders: true,
              canSelectFiles: false,
            };
            const selectedUris =
              await vscode.window.showOpenDialog(openDialogOptions);
            const selectedPath = selectedUris?.[0]?.fsPath;
            if (selectedPath !== undefined) {
              this.panel?.webview.postMessage({
                type: "folder-selected",
                path: selectedPath,
              });
            }
            return;
          }
          case "cancelModal":
            this.panel?.dispose();
            return;
          case "getInitialData":
            if (this.panel) {
              this.postInitialData(this.panel.webview);
            }
            return;
        }
      },
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions,
    );
  }

  private getModalTitle() {
    return this.currentIsNewCommand
      ? "Add New ScriptMate Script"
      : `Edit: ${commandDisplayLabel(this.currentCommandDataForModal!)}`;
  }

  private postInitialData(webview: vscode.Webview) {
    webview.postMessage({
      type: "initialData",
      payload: {
        command: this.currentCommandDataForModal,
        isNew: this.currentIsNewCommand,
      },
    });
  }

  private async handleSaveCommand(scriptDefinition: ScriptDefinition) {
    try {
      if (
        this.currentCommandToEdit &&
        this.currentCommandToEdit.id === scriptDefinition.id
      ) {
        await this.commandStore.updateCommand(scriptDefinition);
        vscode.window.showInformationMessage(
          `ScriptMate: Command "${commandDisplayLabel(
            scriptDefinition,
          )}" updated.`,
        );
      } else if (
        this.commandStore
          .getCommands()
          .some((command) => command.id === scriptDefinition.id)
      ) {
        vscode.window.showErrorMessage(
          `ScriptMate: Command with ID "${scriptDefinition.id}" already exists. Please choose a unique ID.`,
        );
        this.panel?.webview.postMessage({
          type: "saveError",
          payload: { error: "ID_EXISTS", command: scriptDefinition },
        });
        return;
      } else if (
        this.currentCommandToEdit &&
        this.currentCommandToEdit.id !== scriptDefinition.id
      ) {
        await this.commandStore.deleteCommand(this.currentCommandToEdit.id);
        await this.commandStore.addCommand(scriptDefinition);
        vscode.window.showInformationMessage(
          `ScriptMate: Command "${commandDisplayLabel(
            this.currentCommandToEdit,
          )}" updated to "${commandDisplayLabel(scriptDefinition)}" with new ID.`,
        );
      } else {
        await this.commandStore.addCommand(scriptDefinition);
        vscode.window.showInformationMessage(
          `ScriptMate: Command "${commandDisplayLabel(scriptDefinition)}" added.`,
        );
      }
      this.panel?.dispose();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save command: ${error}`);
      this.panel?.webview.postMessage({
        type: "saveError",
        payload: { error: String(error), command: scriptDefinition },
      });
    }
  }
}
