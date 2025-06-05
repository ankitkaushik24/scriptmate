export function getCssSidePanelWebview() {
  return /*css*/ `
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(
            --vscode-side-bar-background,
            var(--vscode-editor-background)
            );
            padding: 0.5em;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        #app {
            flex-grow: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }
        .toolbar {
            margin-bottom: 10px;
            display: flex;
            flex-direction: column;
        }
        .add-command-button-container {
            margin-bottom: 10px; /* Space below add button */
            /* border-top: 1px solid var(--vscode-tree-tableColumnsBorder, var(--vscode-editor-widget-border)); */ /* Removed */
            /* padding-top: 10px; */ /* Removed */
            /* margin-top: auto; */ /* Removed */
        }
        .search-bar-container {
            /* margin-bottom: 10px; */ /* Space between search and add button - now handled by add button container's margin */
        }
        vscode-text-field {
            width: 100%; /* Make search bar take full width */
        }
        .command-list {
            list-style: none;
            padding: 0;
            margin: 0;
            flex-grow: 1; /* Allow list to take remaining space */
            overflow-y: auto; /* Scroll only the list if it overflows */
        }
        .command-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.3em 0.1em;
            border-bottom: 1px solid
            var(
                --vscode-tree-tableColumnsBorder,
                var(--vscode-editor-widget-border)
            );
            margin-bottom: 0.3em;
        }
        .command-item:last-child {
            border-bottom: none;
        }
        .command-label {
            cursor: default;
            flex-grow: 1;
            margin-right: 10px;
            font-size: var(--vscode-font-size);
        }
        .command-description {
            font-size: calc(var(--vscode-font-size) * 0.9);
            color: var(--vscode-descriptionForeground);
            margin-bottom: 2px;
        }
        .actions {
            flex-shrink: 0;
        }
        .actions vscode-button {
            margin-left: 5px;
        }
        /* .add-command-button-container at the bottom styling was removed as it moved to the top */
        vscode-button {
            min-width: 20px; /* Ensure small icon buttons have some width */
        }
        .codicon {
            /* Ensure codicons align well within buttons if text is also present */
            vertical-align: middle;
        }
        .empty-state {
            text-align: center;
            margin-top: 20px;
            color: var(--vscode-descriptionForeground);
            padding: 10px;
        }
  `;
}
