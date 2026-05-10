<template>
  <div class="container" id="app">
    <h1>ScriptMate Settings</h1>

    <div class="setting-group">
      <h2>Custom Commands</h2>
      <div class="setting-row">
        <label for="customCommandsPath">Command Definition File</label>
        <div class="setting-description">
          Absolute path to a JSON file containing your custom ScriptMate command
          definitions.
        </div>
        <div class="input-row">
          <vscode-text-field
            readonly
            id="customCommandsPath"
            placeholder="e.g., /Users/me/scriptmate_commands.json"
            v-model="customCommandsPath"
          ></vscode-text-field>
          <vscode-button id="selectCustomCommandsFile" @click="selectFile"
            >Browse</vscode-button
          >
        </div>
      </div>
    </div>

    <div class="button-group">
      <vscode-button
        id="saveSettings"
        appearance="primary"
        @click="saveSettings"
        >Save Settings</vscode-button
      >
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const vscode = acquireVsCodeApi();

const customCommandsPath = ref("");

const selectFile = () => {
  vscode.postMessage({
    type: "selectFile",
    currentPath: customCommandsPath.value,
  });
};

const saveSettings = () => {
  vscode.postMessage({
    type: "saveSettings",
    settings: {
      customCommandsPath: customCommandsPath.value,
    },
  });
};

onMounted(() => {
  vscode.postMessage({ type: "getSettings" });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "currentSettings":
        customCommandsPath.value = message.settings.customCommandsPath || "";
        break;
      case "fileSelected":
        customCommandsPath.value = message.path;
        break;
    }
  });
});
</script>

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
