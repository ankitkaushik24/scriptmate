import * as vscode from "vscode";
import { getNonce } from "../../utils";

export function getHtmlSettingsWebview(
  webviewPanel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
): string {
  const toolkitUri = webviewPanel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.min.js",
    ),
  );
  const codiconsUri = webviewPanel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css",
    ),
  );

  const scriptUri = webviewPanel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "dist",
      "webviews",
      "settings",
      "main.js",
    ),
  );

  const nonce = getNonce();

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="
            default-src 'none'; 
            font-src ${webviewPanel.webview.cspSource}; 
            style-src ${webviewPanel.webview.cspSource} 'unsafe-inline'; 
            script-src 'nonce-${nonce}' 'unsafe-eval'; 
            connect-src 'none';">
        <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
        <link href="${codiconsUri}" rel="stylesheet" />
        <title>ScriptMate Settings</title>
    </head>
    <body>
        <div id="app"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
    `;
}
