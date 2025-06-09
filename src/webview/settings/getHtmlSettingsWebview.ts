import * as vscode from "vscode";

export function getHtmlSettingsWebview(
  webviewPanel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
): string {
  const toolkitUri = webviewPanel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.min.js"
    )
  );
  const codiconsUri = webviewPanel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css"
    )
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <link href="${codiconsUri}" rel="stylesheet" />
        <title>ScriptMate Settings</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                margin: 0;
                padding: 20px;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
            }
            h1 {
                color: var(--vscode-foreground);
                margin-bottom: 30px;
                font-size: 24px;
            }
            h2 {
                color: var(--vscode-foreground);
                margin: 30px 0 20px 0;
                font-size: 18px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 8px;
            }
            .setting-group {
                margin-bottom: 30px;
            }
            .setting-row {
                display: flex;
                flex-direction: column;
                margin-bottom: 20px;
            }
            .setting-row label {
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--vscode-foreground);
            }
            .setting-description {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 8px;
            }
            .input-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .input-row vscode-text-field {
                flex-grow: 1;
            }
            .button-group {
                margin-top: 40px;
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>ScriptMate Settings</h1>
            
            <div class="setting-group">
                <h2>General Settings</h2>
                <div class="setting-row">
                    <label for="baseDirectory">Base Directory</label>
                    <div class="setting-description">
                        The default directory containing your scripts. This is used as a default argument if a script requires it.
                    </div>
                    <div class="input-row">
                        <vscode-text-field readonly id="baseDirectory" placeholder="e.g., /Users/me/myprojects"></vscode-text-field>
                        <vscode-button id="selectBaseDirectory">Browse</vscode-button>
                    </div>
                </div>
            </div>

            <div class="setting-group">
                <h2>Custom Commands</h2>
                <div class="setting-row">
                    <label for="customCommandsPath">Command Definition File</label>
                    <div class="setting-description">
                        Absolute path to a JSON file containing your custom ScriptMate command definitions.
                    </div>
                    <div class="input-row">
                        <vscode-text-field readonly id="customCommandsPath" placeholder="e.g., /Users/me/scriptmate_commands.json"></vscode-text-field>
                        <vscode-button id="selectCustomCommandsFile">Browse</vscode-button>
                    </div>
                </div>
            </div>

            <div class="button-group">
                <vscode-button id="saveSettings" appearance="primary">Save Settings</vscode-button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            
            // Get DOM elements
            const baseDirectoryInput = document.getElementById('baseDirectory');
            const customCommandsPathInput = document.getElementById('customCommandsPath');
            const selectBaseDirButton = document.getElementById('selectBaseDirectory');
            const selectCommandsFileButton = document.getElementById('selectCustomCommandsFile');
            const saveButton = document.getElementById('saveSettings');

            // Request current settings when page loads
            window.addEventListener('load', () => {
                vscode.postMessage({ type: 'getSettings' });
            });

            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'currentSettings':
                        baseDirectoryInput.value = message.settings.baseDirectory || '';
                        customCommandsPathInput.value = message.settings.customCommandsPath || '';
                        break;
                    case 'directorySelected':
                        baseDirectoryInput.value = message.path;
                        break;
                    case 'fileSelected':
                        customCommandsPathInput.value = message.path;
                        break;
                    case 'settingsSaved':
                        // Both success and error messages are already shown by the extension
                        // No need to show additional messages from the webview
                        break;
                }
            });

            // Browse for base directory
            selectBaseDirButton.addEventListener('click', () => {
                vscode.postMessage({ 
                    type: 'selectDirectory',
                    currentPath: baseDirectoryInput.value 
                });
            });

            // Browse for custom commands file
            selectCommandsFileButton.addEventListener('click', () => {
                vscode.postMessage({ 
                    type: 'selectFile',
                    currentPath: customCommandsPathInput.value 
                });
            });

            // Save settings
            saveButton.addEventListener('click', () => {
                const settings = {
                    baseDirectory: baseDirectoryInput.value,
                    customCommandsPath: customCommandsPathInput.value
                };
                vscode.postMessage({ 
                    type: 'saveSettings',
                    settings: settings 
                });
            });
        </script>
    </body>
    </html>
    `;
}
