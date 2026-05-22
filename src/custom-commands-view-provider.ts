import * as vscode from "vscode";
import { ScriptDefinition } from "./command-definitions";
import { CommandStore } from "./command-store";
import { getHtmlSidePanelWebview } from "./webview/side-panel/getHtmlSidePanelWebview";

export class CustomCommandsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "scriptmate.customCommandsView";

  private _view?: vscode.WebviewView;
  private _commandStore: CommandStore;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._commandStore = CommandStore.getInstance(context);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        // We might add other local resources later (e.g., a global CSS file)
        // For now, 'dist' is less critical for the webview UI itself if all assets are CDN/inline
        // but good to keep if other parts of the webview HTML might reference files there.
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "node_modules",
          "@vscode",
          "codicons",
        ), // For VS Code icons CSS - path adjusted
        vscode.Uri.joinPath(
          // Added entry for webview-ui-toolkit
          this.context.extensionUri,
          "node_modules",
          "@vscode",
          "webview-ui-toolkit",
        ),
      ],
    };

    webviewView.webview.html = getHtmlSidePanelWebview(
      webviewView,
      this.context,
    );

    // Listen for command changes to potentially refresh the view
    const commandStoreListener = this._commandStore.onDidChangeCommands(
      (event) => {
        this._view?.webview.postMessage(event);
      },
    );
    this._view.onDidDispose(() => {
      commandStoreListener.dispose();
    });

    // Handle messages from the webview (Vue app)
    webviewView.webview.onDidReceiveMessage(async (data) => {
      try {
        switch (data.type) {
          case "getInitialCommands": {
            webviewView.webview.postMessage({
              type: "initialCommands",
              payload: this._commandStore.getCommands(),
            });
            break;
          }
          case "runCommand": {
            const commandId = data.payload;
            const command = this._commandStore
              .getCommands()
              .find((c: ScriptDefinition) => c.id === commandId);
            if (command) {
              // This reuses the existing logic in command-handler for prompting args and running
              void vscode.commands
                .executeCommand(
                  "scriptmate.executeRegisteredScript",
                  command.id,
                )
                .then(undefined, (err) => {
                  console.error("ScriptMate: Error executing script", err);
                  vscode.window.showErrorMessage(
                    `ScriptMate: Error executing script. ${err}`,
                  );
                });
            } else {
              vscode.window.showErrorMessage(
                `ScriptMate: Command \"${commandId}\" not found to run.`,
              );
            }
            break;
          }
          case "deleteCommand": {
            // This case might be handled by the new 'showConfirm' flow directly
            // or kept as a direct delete if a confirmation isn't always desired from JS.
            // For now, assuming confirmation is preferred via 'showConfirm'.
            // If direct deletion is needed, this logic can be reinstated fully.
            // try {
            //     await this._commandStore.deleteCommand(data.payload.commandId);
            //     webviewView.webview.postMessage({ type: 'commandDeleted', payload: { commandId: data.payload.commandId, success: true } });
            //     vscode.window.showInformationMessage(`ScriptMate: Command "${data.payload.commandId}" deleted.`);
            // } catch (error) {
            //     vscode.window.showErrorMessage(`Error deleting command: ${error}`);
            //     webviewView.webview.postMessage({ type: 'commandDeleted', payload: { commandId: data.payload.commandId, success: false, error: String(error) } });
            // }
            console.warn(
              "Direct 'deleteCommand' message received, but 'showConfirm' is preferred.",
            );
            break;
          }
          case "showConfirm": {
            const { message, commandIdToDelete } = data.payload;
            const confirmation = await vscode.window.showWarningMessage(
              message,
              { modal: true },
              "Delete",
            );
            if (confirmation === "Delete") {
              try {
                await this._commandStore.deleteCommand(commandIdToDelete);
                // The onDidChangeCommands event from CommandStore will trigger the view refresh.
                // Optionally, send a specific success message back if needed for UI state.
                // webviewView.webview.postMessage({ type: 'commandDeleted', payload: { commandId: commandIdToDelete, success: true } });
                vscode.window.showInformationMessage(
                  `ScriptMate: Command "${commandIdToDelete}" deleted.`,
                );
              } catch (error) {
                vscode.window.showErrorMessage(
                  `Error deleting command "${commandIdToDelete}": ${error}`,
                );
                // Optionally, send a specific failure message back.
                // webviewView.webview.postMessage({ type: 'commandDeleted', payload: { commandId: commandIdToDelete, success: false, error: String(error) } });
              }
            }
            break;
          }
          case "syncCommands": {
            try {
              const { commandCount, aliasCount } =
                await this._commandStore.syncFromFile();
              const aliasPart =
                aliasCount === 1
                  ? "1 shell alias"
                  : `${aliasCount} shell aliases`;
              const message = `Synced ${commandCount} script${
                commandCount === 1 ? "" : "s"
              }${aliasCount > 0 ? ` and ${aliasPart}` : ""}.`;
              vscode.window.showInformationMessage(`ScriptMate: ${message}`);
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(
                `ScriptMate: Sync failed: ${errorMessage}`,
              );
            }
            break;
          }
          case "openSettings": {
            void vscode.commands
              .executeCommand("scriptmate.internal.openSettings")
              .then(undefined, (err) => {
                console.error("ScriptMate: Error opening settings", err);
                vscode.window.showErrorMessage(
                  `ScriptMate: Error opening settings. ${err}`,
                );
              });
            break;
          }
          case "openEditModal":
            // We'll implement this to open a WebviewPanel
            void vscode.commands
              .executeCommand("scriptmate.internal.openEditModal", data.payload)
              .then(undefined, (err) => {
                console.error("ScriptMate: Error opening edit modal", err);
                vscode.window.showErrorMessage(
                  `ScriptMate: Error opening edit modal. ${err}`,
                );
              });
            break;
          case "showError": // For Vue app to show errors via VS Code notifications
            vscode.window.showErrorMessage(data.message);
            break;
          case "showInfo":
            vscode.window.showInformationMessage(data.message);
            break;
          // Add more message handlers as needed (e.g., for adding/updating commands via modal)
        }
      } catch (err) {
        console.error(
          "ScriptMate: Unhandled error in customCommandsViewProvider message handler",
          err,
        );
        vscode.window.showErrorMessage(`ScriptMate: Webview error. ${err}`);
      }
    });

    // Initial request for commands from the Vue app when it's ready
    // The Vue app will send 'getInitialCommands' when it mounts
  }
}
