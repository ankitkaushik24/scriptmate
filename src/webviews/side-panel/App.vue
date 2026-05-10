<template>
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
        <vscode-text-field placeholder="Search scripts..." v-model="searchTerm">
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
          <div class="command-label">{{ displayLabel(command) }}</div>
          <div v-if="command.description" class="command-description">
            {{ command.description }}
          </div>
        </div>
        <vscode-tag v-if="command.shellAlias">
          <span class="alias-tag">{{ command.shellAlias }}</span>
        </vscode-tag>
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
            @click="deleteCommand(command.id, displayLabel(command))"
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";

const vscode = acquireVsCodeApi();

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

const displayLabel = (command) => {
  const l = command.label && String(command.label).trim();
  return l || command.command || command.id;
};

const filteredCommands = computed(() => {
  if (!searchTerm.value) {
    return commands.value;
  }
  const lowerSearchTerm = searchTerm.value.toLowerCase();
  return commands.value.filter((command) => {
    const labelText = command.label && String(command.label).trim();
    const labelMatch =
      labelText && labelText.toLowerCase().includes(lowerSearchTerm);
    const commandMatch =
      command.command &&
      command.command.toLowerCase().includes(lowerSearchTerm);
    const descriptionMatch =
      command.description &&
      command.description.toLowerCase().includes(lowerSearchTerm);
    return labelMatch || commandMatch || descriptionMatch;
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
    }
  });
});
</script>

<style>
@import "./style.css";
</style>
