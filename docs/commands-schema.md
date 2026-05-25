# Command Schema & Argument Assembly

This document defines the schema for `scriptmate-commands.json` and details how arguments are assembled into the final executed command.

## `ScriptDefinition` Schema

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | `string` | **yes** | Stable unique key (e.g. `"deploy-staging"`). Used internally. |
| `command` | `string` | **yes** | Base shell command **without** runtime args (e.g. `"npm run test"`). Args are appended at run time. |
| `args` | `array` | **yes** | Array of argument definitions (`ScriptArgumentDefinition`); use `[]` if none. Order dictates append order. |
| `label` | `string` | no | Title in Quick Pick / side panel. If omitted/blank, `command` is shown. |
| `description` | `string` | no | Subtitle in Quick Pick. |
| `baseDirectory` | `string` | no | Absolute working directory for this script. If omitted/blank: first VS Code workspace folder. Sets terminal `cwd`. |
| `shellAlias` | `string` | no | POSIX identifier (`^[a-zA-Z_][a-zA-Z0-9_]*$`). Extension writes a shell **function** of this name to `~/.zshrc` or `~/.bashrc`. |

## `ScriptArgumentDefinition` Schema

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | `string` | **yes** | Emitted **exactly as written**. ScriptMate does NOT add `-`/`--`. Examples: `"--ticket"`, `"-f"`, `"branch"`. |
| `type` | `string` | **yes** | Must be `"string"`, `"boolean"`, or `"enum"`. |
| `required` | `boolean` | **yes** | Whether user must set a value before Execution. |
| `description` | `string` | no | Shown in argument prompts. |
| `defaultValue` | `string`\|`boolean`| no | Pre-filled at run time. Enum default must be one of `options`. |
| `options` | `array` | enum only| Non-empty string array of allowed values. |
| `isPositional` | `boolean` | no | `string`/`enum` only. If true: append **only the value**, not `name`. Order follows `args` array. |
| `unquoted` | `boolean` | no | `string`/`enum` only. If true: value appended **without** double quotes (shell globbing/splitting). Default: quoted `"value"`. |

## Argument Assembly Rules

At run time ScriptMate builds: `{command} {argsSuffix}` (+ optional user "Additional params").

ScriptMate **NEVER** automatically adds hyphens (`-` or `--`). You must include them in the `name`.

**Assembly per argument:**
- **`boolean`**:
  - If `true`, appends ` {name}` (e.g. `name: "--verbose"` → ` --verbose`).
  - If `false` or unset, appends nothing.
- **`string` / `enum`**:
  - If `isPositional: false`, appends ` {name} "{value}"`.
  - If `isPositional: true`, appends ` "{value}"`.
  - If `unquoted: true`, double quotes are omitted around the value.

**Examples:**
- `name: "--env"`, `type: "enum"`, value `qa` → ` --env "qa"`
- `name: "token"`, `type: "string"`, value `abc`, `isPositional: true` → ` "abc"`
- `name: "*.log"`, `type: "string"`, value `*.log`, `isPositional: true`, `unquoted: true` → ` *.log`
- `name: "-f"`, `type: "boolean"`, value `true` → ` -f`

### Additional Parameters (Runtime)

Before a command executes, users are prompted to optionally provide "Additional parameters". These are appended to the very end of the resolved command (after all arguments) and are **not** stored in the JSON definition. This provides run-time flexibility for adding extra ad-hoc flags or values.

## Validation Checklist

When authoring JSON directly, ensure:
1. `id` is unique across all scripts.
2. `shellAlias` (if set) matches `^[a-zA-Z_][a-zA-Z0-9_]*$` and is unique.
3. For `enum`, `options` array is non-empty and strings are not empty. `defaultValue` must be within `options`.
4. `baseDirectory` is a valid absolute path.
5. Root element is a JSON array `[]`.

## Examples

### Minimal
```json
[
  {
    "id": "run-tests",
    "command": "npm run test",
    "args": []
  }
]
```

### Kitchen Sink
```json
[
  {
    "id": "deploy-app",
    "label": "Deploy Application",
    "description": "Deploys to selected environment",
    "command": "zx scripts/deploy.mjs",
    "baseDirectory": "/absolute/path/to/project",
    "shellAlias": "deploy_app",
    "args": [
      {
        "name": "--env",
        "description": "Target environment",
        "type": "enum",
        "options": ["staging", "production"],
        "defaultValue": "staging",
        "required": true
      },
      {
        "name": "services",
        "description": "Service names to deploy",
        "type": "string",
        "isPositional": true,
        "unquoted": true,
        "required": true
      },
      {
        "name": "--force",
        "type": "boolean",
        "required": false,
        "defaultValue": false
      }
    ]
  }
]
```