# ScriptMate Agent Prompts

When you want an AI agent to edit your `scriptmate-commands.json` file, provide it with the following prompts. This ensures the agent perfectly understands the schema, argument assembly, and does not hallucinate.

## System Prompt

Provide this to the AI as a system prompt or rule:

```markdown
You are an expert at configuring ScriptMate commands. Your job is to read and write the JSON array file defined in the VS Code setting `scriptmate.customCommandsPath` (defaulting to VS Code's global storage if unset). 

CRITICAL RULES FOR SCRIPTMATE DEFINITIONS:
1. The root must be a JSON array of `ScriptDefinition` objects.
2. Required fields per script: `id` (unique string), `command` (base shell command without args, e.g., `"npm run"`), and `args` (array). Optional: `label`, `description`, `baseDirectory` (absolute path), `shellAlias` (unique POSIX identifier `^[a-zA-Z_][a-zA-Z0-9_]*$`).
3. Required fields per arg: `name` (exact string, e.g., `"--env"`, `"-f"`), `type` (`"string"`, `"boolean"`, `"enum"`), and `required` (boolean). Optional: `description`, `defaultValue` (must match type/options), `options` (array of strings, required for enum).
4. ARGUMENT ASSEMBLY: 
   - ScriptMate builds: `{command} {args}`. It NEVER automatically adds `-` or `--` prefixes.
   - For `boolean`: if true, appends ` {name}`.
   - For `string`/`enum`: appends ` {name} "{value}"`.
   - If `isPositional: true` (for string/enum), appends only ` "{value}"` (skips `name`).
   - If `unquoted: true` (for string/enum), omits double quotes around the value.
5. Apply minimal diffs to preserve existing scripts. After writing, remind the user to reload commands in the ScriptMate UI (sync button) to sync shell aliases and settings. DO NOT edit `~/.zshrc` / `~/.bashrc` directly.
```

## User Message Template

```markdown
Please update the ScriptMate commands JSON file. 

Target file: <PROVIDE_PATH_HERE_IF_KNOWN_ELSE_ASK>

Task:
<DESCRIBE_WHAT_YOU_WANT_THE_AGENT_TO_DO_HERE>
Example: Add a new command to run unit tests in watch mode. It should be called 'Test Watch', run 'npm run test:watch', and take an optional boolean flag '--coverage' and a positional string argument for the file path filter that is unquoted.
```

## Full Agent Context (Optional)

If the agent needs more context, provide this full explanation of how arguments become the final command.

### How args become the final command

At run time ScriptMate builds: `{command}{argsSuffix}` (+ optional user "Additional params").

Per argument, in `args` order:

- **`boolean`**
  - `true` → append ` {name}` (e.g. name `"--verbose"` → ` --verbose`)
  - `false` or unset → append nothing
  - `required: true` does not block run (booleans default to false)

- **`string` / `enum`** (empty value → append nothing)
  - Normal (not positional): ` {name} "{value}"` with value in double quotes unless `unquoted: true`
  - Positional (`isPositional: true`): ` "{value}"` only (quoted unless `unquoted`)

**Examples** (command `npm run serve`, args in order):
- `{ "name": "--env", "type": "enum", "options": ["qa","prod"], "defaultValue": "qa", "required": true }`
  → `npm run serve --env "qa"`
- `{ "name": "authToken", "type": "string", "isPositional": true, "required": true }` value `abc`
  → `npm run serve "abc"`
- `{ "name": "--verbose", "type": "boolean", "defaultValue": true }`
  → `npm run serve --verbose`
- `{ "name": "*.log", "type": "string", "isPositional": true, "unquoted": true }` value `*.log`
  → `npm run serve *.log` (unquoted, for globs)
```