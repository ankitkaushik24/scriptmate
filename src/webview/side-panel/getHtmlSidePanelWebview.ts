import * as vscode from "vscode";
import { getNonce } from "../../utils";

export function getHtmlSidePanelWebview(
  webviewView: vscode.WebviewView,
  context: vscode.ExtensionContext,
): string {
  const webview = webviewView.webview;
  const cspSource = webview.cspSource;
  const toolkitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.min.js",
    ),
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css",
    ),
  );

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "dist",
      "webviews",
      "sidePanel",
      "main.js",
    ),
  );

  const nonce = getNonce();

  return /*html*/ `
  <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
        http-equiv="Content-Security-Policy"
        content="
            default-src 'none'; 
            font-src ${cspSource}; 
            style-src ${cspSource} 'unsafe-inline'; 
            script-src 'nonce-${nonce}' 'unsafe-eval'; 
            connect-src 'none';"
        />

        <link href="${codiconsUri}" rel="stylesheet" />
        <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
        <title>ScriptMate Commands</title>
    </head>
    <body>
        <div id="app"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
`;
}
