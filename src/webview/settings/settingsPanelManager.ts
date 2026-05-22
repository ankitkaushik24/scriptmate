import * as vscode from "vscode";
import { getHtmlSettingsWebview } from "./getHtmlSettingsWebview";

export class SettingsPanelManager {
  private static currentPanel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public createOrShowSettingsPanel(): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (SettingsPanelManager.currentPanel) {
      SettingsPanelManager.currentPanel.reveal(columnToShowIn);
      return;
    }

    // Create a new panel
    SettingsPanelManager.currentPanel = vscode.window.createWebviewPanel(
      "scriptmateSettings",
      "ScriptMate Settings",
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
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
      },
    );

    SettingsPanelManager.currentPanel.webview.html = getHtmlSettingsWebview(
      SettingsPanelManager.currentPanel,
      this.context,
    );

    // Handle messages from the webview
    SettingsPanelManager.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.type) {
            case "getSettings":
              await this.sendCurrentSettings();
              break;
            case "selectFile":
              await this.selectFile(message.currentPath);
              break;
            case "saveSettings":
              await this.saveSettings(message.settings);
              break;
            case "showError":
              vscode.window.showErrorMessage(message.message);
              break;
            case "showInfo":
              vscode.window.showInformationMessage(message.message);
              break;
          }
        } catch (error) {
          console.error(
            "ScriptMate: Unhandled error in settingsPanelManager message handler",
            error,
          );
          vscode.window.showErrorMessage(
            `ScriptMate: Settings error. ${error}`,
          );
        }
      },
    );

    // Reset when the current panel is closed
    SettingsPanelManager.currentPanel.onDidDispose(() => {
      SettingsPanelManager.currentPanel = undefined;
    }, null);
  }

  private async sendCurrentSettings(): Promise<void> {
    if (!SettingsPanelManager.currentPanel) {
      return;
    }

    const config = vscode.workspace.getConfiguration("scriptmate");
    const settings = {
      customCommandsPath: config.get<string>("customCommandsPath") || "",
    };

    SettingsPanelManager.currentPanel.webview.postMessage({
      type: "currentSettings",
      settings: settings,
    });
  }

  private async selectFile(currentPath?: string): Promise<void> {
    if (!SettingsPanelManager.currentPanel) {
      return;
    }

    const options: vscode.OpenDialogOptions = {
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
      openLabel: "Select Command Definition File",
      filters: {
        "JSON files": ["json"],
        "All files": ["*"],
      },
    };

    if (currentPath && currentPath.trim()) {
      try {
        options.defaultUri = vscode.Uri.file(currentPath);
      } catch (error) {
        // If current path is invalid, ignore and let user browse from default location
      }
    }

    const result = await vscode.window.showOpenDialog(options);
    if (result && result[0]) {
      SettingsPanelManager.currentPanel.webview.postMessage({
        type: "fileSelected",
        path: result[0].fsPath,
      });
    }
  }

  private async saveSettings(settings: {
    customCommandsPath: string;
  }): Promise<void> {
    if (!SettingsPanelManager.currentPanel) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration("scriptmate");

      // Update custom commands path
      await config.update(
        "customCommandsPath",
        settings.customCommandsPath.trim() || undefined,
        vscode.ConfigurationTarget.Global,
      );

      SettingsPanelManager.currentPanel.webview.postMessage({
        type: "settingsSaved",
        success: true,
      });

      vscode.window.showInformationMessage(
        "ScriptMate settings saved successfully!",
      );
    } catch (error) {
      const errorMessage = `Failed to save settings: ${error}`;
      vscode.window.showErrorMessage(errorMessage);

      SettingsPanelManager.currentPanel.webview.postMessage({
        type: "settingsSaved",
        success: false,
        error: errorMessage,
      });
    }
  }
}
