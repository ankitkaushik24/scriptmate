import * as vscode from "vscode";
import { getNonce } from "../../utils";
import { getCssSidePanelWebview } from "./getCssSidePanelWebview";

export function getHtmlSidePanelWebview(
  webviewView: vscode.WebviewView,
  context: vscode.ExtensionContext
): string {
  const webview = webviewView.webview;
  const vueUri = "https://unpkg.com/vue@3/dist/vue.global.js";
  const cspSource = webview.cspSource;
  const vueOrigin = new URL(vueUri).origin;
  const toolkitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.min.js"
    )
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css"
    )
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
            script-src 'nonce-${nonce}' ${vueOrigin} 'unsafe-eval'; 
            connect-src 'none';"
        />

        <link href="${codiconsUri}" rel="stylesheet" />
        <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
        <script nonce="${nonce}" src="${vueUri}"></script>
        <title>ScriptMate Commands</title>
        <style nonce="${nonce}">
            ${getCssSidePanelWebview()}
        </style>
    </head>
    <body>
        <div id="app">
        <div class="toolbar">
                <div class="buttons-container">
                    <vscode-button
                        class="add-btn"
                        appearance="primary"
                        @click="openAddModal"
                        style="flex: 1"
                    >
                        <span class="codicon codicon-add"></span> Add New Script
                    </vscode-button>
                    <vscode-button
                        class="settings-btn"
                        appearance="secondary"
                        @click="openSettings"
                        style="min-width: 40px"
                        title="Settings"
                    >
                        <span class="codicon codicon-settings-gear"></span>
                    </vscode-button>
                </div>
            <div class="search-bar-container">
            <vscode-text-field
                placeholder="Search scripts..."
                v-model="searchTerm"
            >
                <span slot="start" class="codicon codicon-search"></span>
            </vscode-text-field>
            </div>
        </div>

        <ul class="command-list" v-if="filteredCommands.length > 0">
            <li
            v-for="command in filteredCommands"
            :key="command.id"
            class="command-item"
            >
            <div>
                <div class="command-label">{{ command.label }}</div>
                <div v-if="command.description" class="command-description">
                {{ command.description }}
                </div>
            </div>
            <div class="actions">
                <vscode-button
                appearance="icon"
                @click="runCommand(command.id)"
                title="Run Script"
                >
                <span class="codicon codicon-play"></span>
                </vscode-button>
                <vscode-button
                appearance="icon"
                @click="openEditModal(command)"
                title="Edit Script"
                >
                <span class="codicon codicon-edit"></span>
                </vscode-button>
                <vscode-button
                appearance="icon"
                @click="deleteCommand(command.id, command.label)"
                title="Delete Script"
                >
                <span class="codicon codicon-trash"></span>
                </vscode-button>
            </div>
            </li>
        </ul>
        <div v-else class="empty-state">
            <p v-if="commands.length === 0">No custom scripts defined yet.</p>
            <p v-else-if="searchTerm">
            No scripts match your search for "{{ searchTerm }}".
            </p>
            <p v-if="commands.length === 0">
            Click "Add New Script" above to get started or
            <vscode-link @click="openSettings"
                >configure commands file path</vscode-link
            >.
            </p>
        </div>

        <!-- Add button was here, moved to toolbar -->
        </div>

        <script type="module" nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const { createApp, ref, onMounted, computed } = Vue;

        createApp({
            setup() {
            const commands = ref([]);
            const searchTerm = ref("");

            const postMessage = (message) => {
                vscode.postMessage(message);
            };

            const getInitialCommands = () => {
                postMessage({ type: "getInitialCommands" });
            };

            const runCommand = (commandId) => {
                postMessage({ type: "runCommand", payload: commandId });
            };

            const openAddModal = () => {
                postMessage({ type: "openEditModal", payload: null }); // null for add
            };

            const openEditModal = (command) => {
                // Convert Vue's reactive proxy to a plain JavaScript object
                const plainCommandObject = JSON.parse(JSON.stringify(command));
                postMessage({ type: "openEditModal", payload: plainCommandObject });
            };

            const deleteCommand = (commandId, commandLabel) => {
                vscode.postMessage({
                type: "showConfirm",
                payload: {
                    message:
                    "Are you sure you want to delete the script " +
                    (commandLabel || commandId) +
                    "?",
                    commandIdToDelete: commandId,
                },
                });
            };

            const openSettings = () => {
                postMessage({ type: "openSettings" });
            };

            const filteredCommands = computed(() => {
                if (!searchTerm.value) {
                return commands.value;
                }
                const lowerSearchTerm = searchTerm.value.toLowerCase();
                return commands.value.filter((command) => {
                const labelMatch =
                    command.label &&
                    command.label.toLowerCase().includes(lowerSearchTerm);
                const descriptionMatch =
                    command.description &&
                    command.description.toLowerCase().includes(lowerSearchTerm);
                return labelMatch || descriptionMatch;
                });
            });

            onMounted(() => {
                getInitialCommands();
                window.addEventListener("message", (event) => {
                const message = event.data;
                switch (message.type) {
                    case "initialCommands":
                    commands.value = message.payload || [];
                    break;
                    case "commandsChanged": // This will be sent by the extension when store updates
                    getInitialCommands(); // Re-fetch all commands
                    break;
                    // 'commandDeleted' case can be removed if 'commandsChanged' handles refresh.
                }
                });
            });

            return {
                commands, // keep original commands for empty state logic
                searchTerm,
                filteredCommands,
                runCommand,
                openEditModal,
                openAddModal,
                deleteCommand,
                openSettings,
            };
            },
        }).mount("#app");
        </script>
    </body>
    </html>
`;
}
