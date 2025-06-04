export function getCssFormModalWebview() {
  return /*css*/ `
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        #app-modal-form {
            flex-grow: 1;
            overflow-y: auto;
        }
        .form-group {
            margin-bottom: 15px;
        }
        vscode-text-field, vscode-text-area, vscode-dropdown {
            width: 100%;
        }
        .argument-group {
            padding: 10px;
            border: 1px solid var(--vscode-input-border, var(--vscode-editor-widget-border));
            margin-bottom:10px;
            border-radius: 4px;
        }
        .argument-actions, .form-actions {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
        }
            .argument-actions vscode-button, .form-actions vscode-button {
            margin-left: 10px;
        }
        .form-section-title {
            font-size: 1.1em;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--vscode-editor-widget-border);
            padding-bottom: 5px;
        }
            .checkbox-group {
            display: flex;
            align-items: center;
        }
        .checkbox-group label {
            margin-left: 5px;
            margin-bottom: 0; /* Align with checkbox */
        }
  `;
}
