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
    - Provide custom `prompt` messages for interactive input.
    - Flag string arguments as `isPositional`.
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
- **`scriptmate.baseDirectory`**:
  - **Description**: The absolute path to the directory containing your scripts or projects that your scripts might operate on. This can be used as a default argument or an environment variable within your scripts if needed (e.g., the `serveStagingFromDevtools.mjs` script uses an environment variable `SCRIPTMATE_BASE_DIRECTORY` which can be sourced from this setting).
  - **Example**: `/Users/me/myprojects`.
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

You can access ScriptMate commands through the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS):

- **`ScriptMate: Execute Registered Script...`**: Prompts you to select one of your configured scripts to execute.
- **`ScriptMate: Manage Custom Scripts`**: Opens the ScriptMate view in the Activity Bar, allowing you to add, edit, delete, and run your custom scripts.

## Example: `serveStagingFromDevtools.mjs`

ScriptMate can be used to run scripts like the included `src/scripts/serveStagingFromDevtools.mjs`. This script:

1.  Expects a `--curlString` argument.
2.  Requires the `SCRIPTMATE_BASE_DIRECTORY` environment variable to be set (which can be configured via the `scriptmate.baseDirectory` setting if you adapt the extension to pass it or set it in `scriptmate.globalEnv`).
3.  Changes to a `com.aw.dpa.ui.devtools` directory within the base directory.
4.  Executes `npm run serveStaging -- <curlString>`.

To use this with ScriptMate, you would:

1.  Set your `scriptmate.baseDirectory` in VS Code settings.
2.  Potentially add `SCRIPTMATE_BASE_DIRECTORY`: `"${config:scriptmate.baseDirectory}"` to your `scriptmate.globalEnv` settings.
3.  Define a command in your `customCommands.json`:
    ```json
    [
      {
        "id": "serve-qa",
        "label": "Serve QA",
        "description": "Runs npm run serve:qa",
        "command": "npm run serve:qa",
        "args": [
          {
            "name": "authToken",
            "description": "The auth token to pass to the serve:qa script",
            "type": "string",
            "required": true,
            "prompt": "Enter the auth token:"
          }
        ]
      }
    ]
    ```
4.  Then run "Serve QA" from the ScriptMate view or command palette.

## Known Issues

- Please report any issues on the GitHub repository issues page.

## Release Notes

### 0.0.1

- Initial release of ScriptMate.
- Features: Custom script definition via JSON, argument prompting, `node`, `zx` and shell script execution, dedicated Activity Bar view for script management.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy Scripting with ScriptMate!**
