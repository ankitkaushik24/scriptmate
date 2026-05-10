# ScriptMate: Your VS Code Scripting Companion

ScriptMate streamlines the way you execute your scripts (`shell`, `zx`, `node`, etc.) directly within Visual Studio Code. It provides a convenient interface for managing and running your frequently used scripts, complete with argument handling and a dedicated view for easy access.

Stop juggling terminal windows and context-switching. With ScriptMate, your scripts are just a click away!

## Features

- **Custom Script Management**: Define your scripts in a simple JSON file. ScriptMate provides a dedicated view in the Activity Bar to list, manage (add/edit/delete), and run your custom commands.
  - Configure script `id`, `label` (for display), `description`, and the actual `command` string.
  - Define arguments for your scripts:
    - Specify argument `name`, `description` (used in prompts), `type` (string or boolean).
    - Set `defaultValue` for arguments.
    - Mark arguments as `required`.
    - Flag string arguments as `isPositional`.
  - Choose **working directory** per script: **Workspace folder** (first open folder) or **Custom** with an absolute path (`baseDirectory` in JSON).
  - Optionally set **`shellAlias`**: a POSIX-style function name (`[a-zA-Z_][a-zA-Z0-9_]*`). After a successful save, ScriptMate inserts or updates a marked block in `~/.zshrc` or `~/.bashrc` (from `$SHELL`, or a one-time prompt) defining a **shell function** with that name—same resolved working directory and command as ScriptMate, with `"$@"` forwarded so you can pass extra arguments from the terminal. Clearing the field or deleting the script removes the managed block. Names must be unique across all scripts.
- **Quick Script Execution**:
  - Run registered scripts directly from the ScriptMate view.
  - Context menu integration: Execute scripts on `.mjs` or `.sh` files directly from the Explorer or Editor title context menus (via the "ScriptMate: Execute Registered Script..." command).
- **Argument Handling**: When a script requires arguments, ScriptMate will prompt you for them, using the descriptions and default values you've configured.
- **Activity Bar View**: A dedicated "My Scripts" view in the ScriptMate activity bar panel, providing a webview interface to manage and execute your scripts.
- **Environment Variable Support**: Set global environment variables for all executed scripts using VS Code variable syntax (e.g., `${workspaceFolder}`).

## Requirements

- Node.js and `npm`.
- Others as per your commands definition.

## Extension Settings

ScriptMate contributes the following settings (accessible via `File > Preferences > Settings` and searching for "ScriptMate"):

- **`scriptmate.customCommandsPath`**:
  - **Description**: Absolute path to a JSON file containing your custom ScriptMate command definitions. This is the heart of your ScriptMate setup.
  - **Example**: `/Users/me/my_scriptmate_commands.json` or `C:\Users\me\my_scriptmate_commands.json`.
  - **Default**: `""` (You **must** set this to use custom commands via the UI).
- **`scriptmate.globalEnv`**:
  - **Description**: Global environment variables to set for all executed scripts. Values can use supported VS Code variable syntax (e.g., `${workspaceFolder}`, `${userHome}`, `${config:your.setting}`, `${env:SYS_VAR}`).
  - **Default**: `{}`
  - **Example**:
    ```json
    "scriptmate.globalEnv": {
      "API_KEY": "your_api_key_here",
      "NODE_ENV": "development",
      "PROJECT_ROOT": "${workspaceFolder}"
    }
    ```

## Available Commands

You can access ScriptMate commands through the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) or from the activity bar:

- **`ScriptMate: Execute Registered Script...`**: Prompts you to select one of your configured scripts to execute.

## Example: `serveStagingFromDevtools.mjs`

ScriptMate can be used to run scripts like the included `src/scripts/serveStagingFromDevtools.mjs`. This script:

1.  Expects a `--curlString` argument.
2.  Expects `SCRIPTMATE_BASE_DIRECTORY` when ScriptMate runs the script (the extension sets it to the resolved working directory: per-script `baseDirectory`, or the first workspace folder when that field is blank).
3.  Changes to a `com.aw.dpa.ui.devtools` directory within the base directory.
4.  Executes `npm run serveQa -- <curlString>`.

To use this with ScriptMate, you would:

1.  Open the repo as a workspace (or set per-script `baseDirectory` to the project root).
2.  Optionally add extra env in `scriptmate.globalEnv` if the script needs more variables.
3.  Define a command in your `customCommands.json`:
    ```json
    [
      {
        "id": "serve-qa",
        "label": "Serve QA",
        "description": "Runs npm run serve:qa",
        "command": "npm run serve:qa",
        "baseDirectory": "/path/to/your/project",
        "shellAlias": "serve_qa",
        "args": [
          {
            "name": "authToken",
            "description": "The auth token to pass to the serve:qa script",
            "type": "string",
            "required": true
          }
        ]
      }
    ]
    ```
4.  Then run "Serve QA" from the ScriptMate view or command palette.

## Known Issues

- Please report any issues on the GitHub repository issues page.

### Shell functions (`shellAlias`)

- ScriptMate **edits your shell rc file** between marker comments and writes a **function**, not a one-line `alias`, so quoting stays simple (only the `cd` path is single-quoted), you can rely on normal shell syntax in your command, and extra CLI args are forwarded via `"$@"`. Merge conflicts are still possible if you edit the same region by hand; fish and other shells are not targeted automatically (pick `~/.zshrc` / `~/.bashrc` when prompted).
- Reload your terminal or run `source ~/.zshrc` (or the file you chose) after the first write.

## Release Notes

### 0.0.1

- Initial release of ScriptMate.
- Features: Custom script definition via JSON, argument prompting, `node`, `zx` and shell script execution, dedicated Activity Bar view for script management.

---

**Enjoy Scripting with ScriptMate!**
