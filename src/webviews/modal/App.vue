<template>
  <div id="app-modal-form">
    <p v-if="loading">Loading form...</p>

    <div v-if="!loading">
      <div class="form-group">
        <vscode-text-field
          v-model="formData.label"
          placeholder="Defaults to command string if empty"
          >Label (optional, Quick Pick & UI):</vscode-text-field
        >
      </div>
      <div class="form-group">
        <vscode-text-area v-model="formData.description" rows="2"
          >Description (optional):</vscode-text-area
        >
      </div>
      <div class="form-group">
        <vscode-text-field v-model="formData.command"
          >Command String (e.g., zx src/my.mjs, npm run
          task):</vscode-text-field
        >
      </div>
      <div class="form-group">
        <vscode-radio-group :value="cwdMode" @change="onCwdModeChange">
          <label slot="label">Working directory</label>
          <vscode-radio value="workspace"
            >Workspace folder (first open folder)</vscode-radio
          >
          <vscode-radio value="custom">Custom directory</vscode-radio>
        </vscode-radio-group>
      </div>
      <div class="form-group cwd-custom-row" v-if="cwdMode === 'custom'">
        <vscode-text-field
          v-model="formData.baseDirectory"
          readonly
          placeholder="Absolute path"
          >Directory:</vscode-text-field
        >
        <vscode-button appearance="secondary" @click="selectBaseDirectory"
          >Browse...</vscode-button
        >
      </div>
      <div class="form-group">
        <vscode-text-field
          v-model="formData.shellAlias"
          placeholder="e.g. deploy_staging (optional)"
          >Shell alias name:</vscode-text-field
        >
        <div class="field-hint">
          Optional. Name for a alias in your shell rc (same identifier rules).
          Forwards extra args with "$@". Written on save.
        </div>
      </div>

      <div class="form-section-title">
        Arguments ({{ formData.args.length }})
      </div>
      <div
        v-for="(arg, index) in formData.args"
        :key="index"
        class="argument-group"
      >
        <vscode-button
          appearance="icon"
          @click="removeArgument(index)"
          title="Remove this argument"
          style="float: right"
        >
          <span class="codicon codicon-trash"></span>
        </vscode-button>
        <div class="form-group">
          <vscode-text-field v-model="arg.name"
            >Name (e.g., ticketId, filePath):</vscode-text-field
          >
        </div>
        <div class="form-group">
          <vscode-text-area
            v-model="arg.description"
            rows="2"
            placeholder="Defaults to argument name"
            >Description (optional, for prompts):</vscode-text-area
          >
        </div>
        <div class="form-group">
          <label>Type</label>
          <vscode-dropdown v-model="arg.type">
            <vscode-option value="string" :selected="arg.type === 'string'"
              >String</vscode-option
            >
            <vscode-option value="boolean" :selected="arg.type === 'boolean'"
              >Boolean</vscode-option
            >
          </vscode-dropdown>
        </div>
        <div class="form-group" v-if="arg.type === 'string'">
          <vscode-text-field v-model="arg.defaultValue"
            >Default Value (string, optional):</vscode-text-field
          >
        </div>
        <div class="form-group" v-if="arg.type === 'boolean'">
          <vscode-radio-group
            :value="arg.defaultValue"
            @change="arg.defaultValue = $event.target.value"
          >
            <label slot="label">Default Value (boolean, optional)</label>
            <vscode-radio :value="true">True</vscode-radio>
            <vscode-radio :value="false">False</vscode-radio>
          </vscode-radio-group>
        </div>
        <div class="form-group checkbox-group">
          <vscode-checkbox
            :checked="arg.required"
            @change="arg.required = $event.target.checked"
            >Required</vscode-checkbox
          >
        </div>
        <div class="form-group checkbox-group" v-if="arg.type === 'string'">
          <vscode-checkbox
            :checked="arg.isPositional"
            @change="arg.isPositional = $event.target.checked"
            >Positional Argument (string only)</vscode-checkbox
          >
        </div>
      </div>
      <vscode-button appearance="secondary" @click="addArgument"
        >Add Argument</vscode-button
      >

      <div class="form-actions">
        <vscode-button @click="cancel">Cancel</vscode-button>
        <vscode-button appearance="primary" @click="save"
          >Save Command</vscode-button
        >
      </div>
      <div
        v-if="saveError"
        ref="saveErrorBanner"
        style="color: var(--vscode-errorForeground); margin-top: 10px"
      >
        Error saving: {{ saveError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from "vue";

const vscode = acquireVsCodeApi();

const loading = ref(true);
const isEditMode = ref(false);
const originalId = ref(null);
const saveError = ref(null);
const saveErrorBanner = ref(null);

watch(saveError, async (msg) => {
  if (!msg) {
    return;
  }
  await nextTick();
  saveErrorBanner.value?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
});
const cwdMode = ref("workspace");

const formData = reactive({
  id: "",
  label: "",
  description: "",
  command: "",
  baseDirectory: "",
  shellAlias: "",
  args: [],
});

const shellAliasPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const resetForm = (data = {}, isNew = false) => {
  formData.id = data.id || "";
  formData.label = data.label || "";
  formData.description = data.description || "";
  formData.command = data.command || "";
  formData.baseDirectory = data.baseDirectory || "";
  formData.shellAlias = data.shellAlias || "";
  formData.args = JSON.parse(JSON.stringify(data.args || []));
  cwdMode.value = (formData.baseDirectory || "").trim()
    ? "custom"
    : "workspace";
  if (cwdMode.value === "workspace") {
    formData.baseDirectory = "";
  }
  isEditMode.value = !isNew;
  originalId.value = !isNew ? data.id : null;
  loading.value = false;
  saveError.value = null;
};

const onCwdModeChange = (e) => {
  cwdMode.value = e.target.value;
  if (cwdMode.value === "workspace") {
    formData.baseDirectory = "";
  }
};

const selectBaseDirectory = () => {
  cwdMode.value = "custom";
  vscode.postMessage({ type: "select-folder" });
};

const addArgument = () => {
  formData.args.push({
    name: "",
    description: "",
    type: "string",
    defaultValue: "",
    required: false,
    isPositional: false,
  });
};

const removeArgument = (index) => {
  formData.args.splice(index, 1);
};

const save = () => {
  saveError.value = null;
  if (!formData.id || !String(formData.command || "").trim()) {
    saveError.value = "ID and Command String are required.";
    return;
  }
  for (const arg of formData.args) {
    if (!String(arg.name || "").trim()) {
      saveError.value = "Each argument must have a Name.";
      return;
    }
  }
  const aliasTrim = (formData.shellAlias || "").trim();
  if (aliasTrim && !shellAliasPattern.test(aliasTrim)) {
    saveError.value =
      "Shell alias must be a valid identifier (letters, digits, underscore; cannot start with a digit).";
    return;
  }
  if (cwdMode.value === "workspace") {
    formData.baseDirectory = "";
  }
  formData.args.forEach((arg) => {
    if (arg.type === "boolean") {
      if (arg.defaultValue === "true") arg.defaultValue = true;
      else if (arg.defaultValue === "false") arg.defaultValue = false;
      else if (arg.defaultValue === "") delete arg.defaultValue;
    }
  });

  const payload = JSON.parse(JSON.stringify(formData));
  vscode.postMessage({ type: "saveCommand", payload });
};

const cancel = () => {
  vscode.postMessage({ type: "cancelModal" });
};

onMounted(() => {
  vscode.postMessage({ type: "getInitialData" });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "initialData":
        resetForm(message.payload.command, message.payload.isNew);
        break;
      case "folder-selected":
        formData.baseDirectory = message.path;
        break;
      case "saveError":
        saveError.value = message.payload.error;
        break;
    }
  });
});
</script>

<style>
@import "./style.css";
</style>
