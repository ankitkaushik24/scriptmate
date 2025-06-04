import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ScriptDefinition } from "./command-definitions";

const SCRIPTMATE_COMMANDS_JSON = "scriptmate-commands.json";

export class CommandStore {
  private static instance: CommandStore;
  private _commands: ScriptDefinition[] = [];
  private _customCommandsJsonPath: string | null = null;

  private _onDidChangeCommands = new vscode.EventEmitter<void>();
  public readonly onDidChangeCommands: vscode.Event<void> =
    this._onDidChangeCommands.event;

  private constructor(private context: vscode.ExtensionContext) {
    this.resolveCustomCommandsPath();
    this.loadCommands();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("scriptmate.customCommandsPath")) {
        this.resolveCustomCommandsPath();
        this.loadCommands();
      }
    });
  }

  public static getInstance(context: vscode.ExtensionContext): CommandStore {
    if (!CommandStore.instance) {
      CommandStore.instance = new CommandStore(context);
    }
    return CommandStore.instance;
  }

  private resolveCustomCommandsPath() {
    const configPath = vscode.workspace
      .getConfiguration("scriptmate")
      .get<string | null>("customCommandsPath");
    if (configPath && path.isAbsolute(configPath)) {
      this._customCommandsJsonPath = configPath;
    } else if (configPath) {
      vscode.window.showWarningMessage(
        `Invalid path for scriptmate.customCommandsPath: "${configPath}". Path must be absolute. Using default location.`
      );
      this._customCommandsJsonPath = this.getDefaultCommandsPath();
    } else {
      this._customCommandsJsonPath = this.getDefaultCommandsPath();
    }
    console.log(
      "ScriptMate: Custom commands path resolved to:",
      this._customCommandsJsonPath
    );
  }

  private getDefaultCommandsPath(): string {
    const defaultPath = path.join(
      this.context.globalStorageUri.fsPath,
      SCRIPTMATE_COMMANDS_JSON
    );
    // Ensure the global storage directory exists
    if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
      fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
    }
    return defaultPath;
  }

  public getCommandsPath(): string | null {
    return this._customCommandsJsonPath;
  }

  public getCommands(): ScriptDefinition[] {
    return [...this._commands]; // Return a copy
  }

  public async loadCommands(): Promise<void> {
    if (!this._customCommandsJsonPath) {
      this._commands = [];
      this._onDidChangeCommands.fire();
      return;
    }

    try {
      if (fs.existsSync(this._customCommandsJsonPath)) {
        const fileContent = fs.readFileSync(
          this._customCommandsJsonPath,
          "utf-8"
        );
        if (fileContent.trim() === "") {
          this._commands = [];
        } else {
          this._commands = JSON.parse(fileContent) as ScriptDefinition[];
          // Basic validation (can be expanded)
          if (
            !Array.isArray(this._commands) ||
            !this._commands.every((cmd) => cmd.id && cmd.label && cmd.command)
          ) {
            vscode.window.showErrorMessage(
              `Error loading ScriptMate commands: ${this._customCommandsJsonPath} contains invalid data.`
            );
            this._commands = [];
          }
        }
      } else {
        this._commands = [];
        // Optionally, create the file if it doesn't exist with an empty array
        // await this.saveCommands();
        console.log(
          `ScriptMate: Commands file not found at ${this._customCommandsJsonPath}. Starting with empty list.`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error loading ScriptMate commands from ${
          this._customCommandsJsonPath
        }: ${error instanceof Error ? error.message : String(error)}`
      );
      this._commands = [];
    }
    this._onDidChangeCommands.fire();
  }

  private async saveCommands(): Promise<void> {
    if (!this._customCommandsJsonPath) {
      vscode.window.showErrorMessage(
        "ScriptMate: Cannot save commands, path is not set."
      );
      return;
    }
    try {
      const jsonContent = JSON.stringify(this._commands, null, 2);
      fs.writeFileSync(this._customCommandsJsonPath, jsonContent, "utf-8");
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error saving ScriptMate commands to ${this._customCommandsJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error; // Re-throw for the caller to handle if needed
    }
  }

  public async addCommand(command: ScriptDefinition): Promise<void> {
    if (this._commands.some((c) => c.id === command.id)) {
      vscode.window.showErrorMessage(
        `ScriptMate: Command with ID '${command.id}' already exists.`
      );
      throw new Error(`Command with ID '${command.id}' already exists.`);
    }
    this._commands.push(command);
    await this.saveCommands();
    this._onDidChangeCommands.fire();
  }

  public async updateCommand(updatedCommand: ScriptDefinition): Promise<void> {
    const index = this._commands.findIndex((c) => c.id === updatedCommand.id);
    if (index === -1) {
      vscode.window.showErrorMessage(
        `ScriptMate: Command with ID '${updatedCommand.id}' not found for update.`
      );
      throw new Error(`Command with ID '${updatedCommand.id}' not found.`);
    }
    this._commands[index] = updatedCommand;
    await this.saveCommands();
    this._onDidChangeCommands.fire();
  }

  public async deleteCommand(commandId: string): Promise<void> {
    const initialLength = this._commands.length;
    this._commands = this._commands.filter((c) => c.id !== commandId);
    if (this._commands.length === initialLength) {
      vscode.window
        .showWarningMessage(`ScriptMate: Command with ID '${commandId}' not found for deletion.\`);
            // Optionally throw an error, or just return if non-existence is not critical
            // throw new Error(\`Command with ID '${commandId}' not found.`);
      return;
    }
    await this.saveCommands();
    this._onDidChangeCommands.fire();
  }
}
