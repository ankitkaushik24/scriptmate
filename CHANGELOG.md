# Change Log

All notable changes to the "scriptmate" extension will be documented in this file.

## [0.2.0] - 2025-06-09

### Added

- **Settings Panel**: New dedicated settings interface accessible via settings icon in the side panel
- **Visual Settings Management**: Easy-to-use interface for configuring base directory and custom command definition file
- **File/Directory Browser Integration**: Browse buttons for selecting directories and files directly from the settings panel
- **Auto-populated Default Paths**: VS Code settings now automatically show the actual default paths being used instead of empty fields
- **Enhanced Settings Transparency**: Users can now clearly see where their command definitions are stored

### Changed

- **Improved Settings Visibility**: The `customCommandsPath` setting now auto-populates with the default path when empty, making it visible in VS Code's native settings UI
- **Single-page Settings Layout**: All settings are displayed on one page for better usability (removed tabbed interface)

## [0.1.0] - 2025-06-05

### Added

- **Per-Script Base Directory**: Each script can now have its own `baseDirectory`, which overrides the global setting. This allows for more flexible project structures.
- The "Add/Edit Script" form now includes a "Browse..." button to easily select the base directory.
- When creating a new script, the `baseDirectory` field now defaults to the global setting.

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
