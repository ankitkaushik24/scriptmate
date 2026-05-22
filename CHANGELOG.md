# Change Log

All notable changes to the "scriptmate" extension will be documented in this file.

## [1.4.0] - 2026-05-22

### Added

- **Side Panel**: Added sync functionality and `retainContextWhenHidden` for the side panel, along with enhanced feedback for command loading and execution errors.

## [1.3.0] - 2026-05-18

### Added

- **Enum Script Arguments**: Added support for `enum` type in script argument definitions, including validation and UI updates for enum options in the Add/Edit modal.
- **Additional Parameters**: Added support for additional parameters in command prompts for enhanced user input flexibility and command execution.

### Changed

- **Command Arguments**: Stopped automatically prepending hyphens (`-` or `--`) to flags and arguments during execution; they are now passed exactly as defined in the script configuration.

## [1.2.2] - 2026-05-12

### Added

- When editing a script, each argument shows a **short command preview** (hover for details).

### Changed

- **On/off flags** with a one-letter name now appear as `-f` instead of `--f`, like most command-line tools.
- **Edit form**: Command is asked for first; script arguments and hints are a bit easier to scan.

## [1.2.1] - 2026-05-12

### Added

- **Modal**: When validation fails, the form **scrolls to the error shown** so the problem is visible without manual scrolling.

## [1.2.0] - 2026-05-12

### Changed

- Streamlined command loading, modal lifecycle, and configuration handling; removed unused Explorer/editor context menu entries.
- User-facing copy now consistently describes optional `shellAlias` integration as a **shell alias** (command-definition text, prompts, and notifications).

### Fixed

- More reliable **focus behavior** when stepping through script argument prompts.

## [1.1.0] - 2026-05-11

### Added

- **Webview build**: Vite-based bundling for modal, settings, and side-panel webviews with Vue single-file components and clearer separation from extension host code.
- **Side panel**: Each script can show its configured **shell alias** as a tag next to the label when `shellAlias` is set.
- **Open VSX**: Publishing support and task wiring for the Open VSX registry (Cursor discoverability), with related dependency updates.
- **VS Code Marketplace**: Publish tasks and updated authentication instructions for shipping to the Microsoft Marketplace.

### Changed

- **Command definitions I/O**: Non-blocking persistence path in the command store, with tidier handling and clearer error messages when loading or saving definitions.

## [1.0.0] - 2026-05-10

### Changed

- **Stable 1.x**: Semver move to `1.0.0` with follow-up polish to settings management, working-directory handling, `shellAlias` integration, and command-definition UI. User-visible capabilities for the settings panel, `baseDirectory`, and `shellAlias` are summarized in the **0.2.0** section below.

## [0.2.0] - 2025-06-09

### Added

- **Settings Panel**: New dedicated settings interface accessible via settings icon in the side panel
- **Visual Settings Management**: Easy-to-use interface for configuring the custom command definition file
- **File Browser Integration**: Browse button for selecting the command definitions file from the settings panel
- **Auto-populated Default Paths**: VS Code settings now automatically show the actual default paths being used instead of empty fields
- **Enhanced Settings Transparency**: Users can now clearly see where their command definitions are stored
- **Add/Edit modal — working directory**: Radio choice between workspace folder and custom directory (with folder picker).
- **Optional `shellAlias`**: Globally unique name per script; on successful save ScriptMate updates a marked block in `~/.zshrc` or `~/.bashrc` (from `$SHELL`, else a one-time QuickPick) with a **shell alias** (readable body, `"$@"` forwarding, minimal quoting on the `cd` path only).

### Changed

- **Improved Settings Visibility**: The `customCommandsPath` setting now auto-populates with the default path when empty, making it visible in VS Code's native settings UI
- **Single-page Settings Layout**: All settings are displayed on one page for better usability (removed tabbed interface)
- **Working directory**: Scripts use per-command `baseDirectory` when set; otherwise the first workspace folder. Execution preview and `SCRIPTMATE_BASE_DIRECTORY` follow the same resolution.

### Removed

- **`scriptmate.baseDirectory`**: Removed from VS Code configuration and from the ScriptMate settings webview; use per-script `baseDirectory` or rely on the workspace folder.

## [0.1.0] - 2025-06-05

### Added

- **Per-Script Base Directory**: Each script can optionally set `baseDirectory` for a custom working directory.
- The "Add/Edit Script" form now includes a "Browse..." button to easily select the base directory.
- When creating a new script, the `baseDirectory` field starts empty (workspace-relative behavior).

### Changed

- **Removed Custom Prompts**: The ability to set custom prompt messages for script arguments has been removed to simplify the UI and standardize the user experience.
- **Hidden Script ID**: The auto-generated script ID is no longer displayed in the "Add/Edit Script" form, creating a cleaner interface.

### Fixed

- **Webview Resource Loading**: Fixed a critical issue where the extension would fail to load webview components (`@vscode/webview-ui-toolkit` and `@vscode/codicons`) after being published. This resolved the "Service worker controller not found" error.

## [0.0.2] - 2025-06-04

- Updated extension icon

## [0.0.1] - 2025-06-04

- Initial release of ScriptMate.
- Features: Custom script definition via JSON, argument prompting, `node`, `zx` and shell script execution, dedicated Activity Bar view for script management.

---

This format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
