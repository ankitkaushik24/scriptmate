<template>
  <div id="app-modal-form">
    <p v-if="loading">Loading form...</p>

    <template v-if="!loading">
      <div class="form-group">
        <vscode-text-field v-model="formData.command"
          >Command String (e.g., zx src/my.mjs, npm run
          task):</vscode-text-field
        >
      </div>
      <div class="form-group">
        <vscode-text-field
          v-model="formData.label"
          placeholder="Defaults to command string if empty"
          >Label (optional, Quick Pick & UI):</vscode-text-field
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
          >Shell alias name (optional):</vscode-text-field
        >
        <div class="field-hint">Name for a alias in your shell rc.</div>
      </div>
      <div class="form-group">
        <vscode-text-area v-model="formData.description" rows="2"
          >Description (optional):</vscode-text-area
        >
      </div>

      <div class="form-section-title">
        Arguments ({{ formData.args.length }})
      </div>
      <div
        v-for="(arg, index) in formData.args"
        :key="index"
        class="argument-group"
      >
        <div class="argument-group-header">
          <div
            class="argument-cli-preview"
            :title="argumentCommandPreview(arg).title"
          >
            {{ argumentCommandPreview(arg).line }}
          </div>
          <vscode-button
            appearance="icon"
            @click="removeArgument(index)"
            title="Remove this argument"
          >
            <span class="codicon codicon-trash"></span>
          </vscode-button>
        </div>
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
          <vscode-dropdown :value="arg.type" @change="setArgType(arg, $event)">
            <vscode-option value="string" :selected="arg.type === 'string'"
              >String</vscode-option
            >
            <vscode-option value="boolean" :selected="arg.type === 'boolean'"
              >Boolean</vscode-option
            >
            <vscode-option value="enum" :selected="arg.type === 'enum'"
              >Enum</vscode-option
            >
          </vscode-dropdown>
        </div>
        <div class="form-group" v-if="arg.type === 'enum'">
          <vscode-text-area
            v-model="arg.enumOptionsText"
            rows="4"
            placeholder="One option per line"
            >Enum options (one per line):</vscode-text-area
          >
        </div>
        <div class="form-group" v-if="arg.type === 'string'">
          <vscode-text-field v-model="arg.defaultValue"
            >Default Value (string, optional):</vscode-text-field
          >
        </div>
        <div class="form-group" v-if="arg.type === 'enum'">
          <label>Default value (optional)</label>
          <vscode-dropdown
            :value="enumDefaultSelectValue(arg)"
            @change="onEnumDefaultDropdownChange(arg, $event)"
          >
            <vscode-option value="" :selected="!hasEnumDefault(arg)"
              >(none)</vscode-option
            >
            <vscode-option
              v-for="opt in parsedEnumOptions(arg)"
              :key="opt"
              :value="opt"
              :selected="enumDefaultSelectValue(arg) === opt"
              >{{ opt }}</vscode-option
            >
          </vscode-dropdown>
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
        <div
          class="form-group checkbox-group"
          v-if="arg.type === 'string' || arg.type === 'enum'"
        >
          <vscode-checkbox
            :checked="arg.isPositional"
            @change="arg.isPositional = $event.target.checked"
            >Positional argument (string or enum)</vscode-checkbox
          >
        </div>
        <div
          class="form-group checkbox-group"
          v-if="arg.type === 'string' || arg.type === 'enum'"
        >
          <vscode-checkbox
            :checked="!!arg.unquoted"
            @change="arg.unquoted = $event.target.checked || undefined"
            >Unquoted value</vscode-checkbox
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
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from "vue";
import { formatArgumentFragment } from "../../cli-argument-fragment";

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
  const clonedArgs = JSON.parse(JSON.stringify(data.args || []));
  for (const arg of clonedArgs) {
    if (arg.type === "enum") {
      arg.enumOptionsText = (arg.options || []).join("\n");
    }
  }
  formData.args = clonedArgs;
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

const parsedEnumOptions = (arg) => {
  return String(arg.enumOptionsText || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
};

const hasEnumDefault = (arg) => {
  return typeof arg.defaultValue === "string" && arg.defaultValue.trim() !== "";
};

const enumDefaultSelectValue = (arg) => {
  return hasEnumDefault(arg) ? String(arg.defaultValue).trim() : "";
};

const onEnumDefaultDropdownChange = (arg, ev) => {
  const v = ev.target.value;
  if (v === "") {
    delete arg.defaultValue;
  } else {
    arg.defaultValue = v;
  }
};

const setArgType = (arg, ev) => {
  const nextType = ev.target.value;
  if (arg.type === nextType) {
    return;
  }
  const prev = arg.type;
  arg.type = nextType;
  if (nextType === "boolean") {
    arg.isPositional = false;
    delete arg.unquoted;
  }
  if (nextType === "enum") {
    if (prev !== "enum") {
      arg.enumOptionsText = "";
      delete arg.defaultValue;
    }
    if (typeof arg.enumOptionsText !== "string") {
      arg.enumOptionsText = (arg.options || []).join("\n");
    }
  } else {
    delete arg.enumOptionsText;
    delete arg.options;
  }
  if (nextType === "boolean" && typeof arg.defaultValue === "string") {
    delete arg.defaultValue;
  }
  if (nextType === "string" && typeof arg.defaultValue === "boolean") {
    delete arg.defaultValue;
  }
};

/** How this argument appears in the executed command (matches extension behavior). */
const argumentCommandPreview = (arg) => {
  const name = String(arg.name || "").trim();
  if (!name) {
    return {
      line: "—",
      title:
        "Set a name to see how this argument is appended when the script runs.",
    };
  }

  const argType =
    arg.type === "boolean"
      ? "boolean"
      : arg.type === "enum"
        ? "enum"
        : "string";
  const argFmt = {
    name,
    type: argType,
    isPositional:
      (argType === "string" || argType === "enum") && !!arg.isPositional,
    unquoted: (argType === "string" || argType === "enum") && !!arg.unquoted,
  };
  const cmd = String(formData.command || "").trim();

  if (argFmt.type === "boolean") {
    const whenTrue = formatArgumentFragment(argFmt, true);
    const flag = whenTrue.trim();
    const optional = `[${flag}]`;
    const line = cmd ? `${cmd} ${optional}` : optional;
    const title = `${line}\n\nWhen true, ${flag || "nothing"} is appended after the command; when false, it is omitted (brackets show optional inclusion).`;
    return { line, title };
  }

  if (argFmt.type === "enum") {
    const opts = parsedEnumOptions(arg);
    let sample =
      typeof arg.defaultValue === "string" ? arg.defaultValue.trim() : "";
    if (!sample && opts.length > 0) {
      sample = opts[0];
    }
    if (!sample) {
      sample = "<value>";
    }
    const frag = formatArgumentFragment(argFmt, sample);
    const line = cmd
      ? `${cmd}${frag}`
      : (frag || "").trimStart() || "(empty value adds nothing)";
    const title =
      frag.trim() === ""
        ? `${line}\n\nWith an empty value, this argument adds no fragment.`
        : `${line}\n\nPreview uses ${sample === "<value>" ? "placeholder <value>" : sample}; quotes match execution.`;
    return { line, title };
  }

  let sample =
    typeof arg.defaultValue === "string" ? arg.defaultValue.trim() : "";
  if (!sample) {
    sample = "<value>";
  }
  const frag = formatArgumentFragment(argFmt, sample);
  const line = cmd
    ? `${cmd}${frag}`
    : (frag || "").trimStart() || "(empty value adds nothing)";
  const title =
    frag.trim() === ""
      ? `${line}\n\nWith an empty string value, this argument adds no fragment. Preview uses placeholder ${sample}.`
      : `${line}\n\nPreview uses ${sample === "<value>" ? "placeholder <value>" : "the default value"}; quotes match execution.`;
  return { line, title };
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
    if (arg.type === "enum") {
      const opts = parsedEnumOptions(arg);
      if (opts.length === 0) {
        saveError.value =
          "Each enum argument needs at least one non-empty option (one per line).";
        return;
      }
      if (hasEnumDefault(arg)) {
        const d = String(arg.defaultValue).trim();
        if (!opts.includes(d)) {
          saveError.value = `Enum default for "${String(arg.name).trim()}" must be one of the listed options.`;
          return;
        }
      }
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
  for (const arg of payload.args) {
    if (arg.type === "enum") {
      arg.options = parsedEnumOptions(arg);
      delete arg.enumOptionsText;
    }
  }
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
