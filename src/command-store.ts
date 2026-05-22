import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ScriptDefinition } from "./command-definitions";
import {
  normalizeScriptDefinition,
  validateScriptDefinitionForPersistence,
} from "./script-persistence";
import {
  syncAllShellAliases,
  syncShellAliasTransition,
  validateShellAliasForRc,
} from "./shell-profile-alias";

const SCRIPTMATE_COMMANDS_JSON = "scriptmate-commands.json";

export type CommandChangeEvent =
  | { type: "commandAdded"; payload: ScriptDefinition }
  | { type: "commandUpdated"; payload: ScriptDefinition }
  | { type: "commandDeleted"; payload: string }
  | { type: "commandsChanged" };

export class CommandStore {
  private static instance: CommandStore;
  private _commands: ScriptDefinition[] = [];
  private _customCommandsJsonPath: string | null = null;

  private _onDidChangeCommands = new vscode.EventEmitter<CommandChangeEvent>();
  public readonly onDidChangeCommands: vscode.Event<CommandChangeEvent> =
    this._onDidChangeCommands.event;

  private constructor(private context: vscode.ExtensionContext) {
    this.resolveCustomCommandsPath();
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("scriptmate.customCommandsPath")) {
          this.resolveCustomCommandsPath();
          this.loadCommands().catch((error) => {
            console.error(
              "ScriptMate: Failed to load commands after config change",
              error,
            );
            vscode.window.showErrorMessage(
              `ScriptMate: Failed to load commands after config change. ${error}`,
            );
          });
        }
      }),
    );
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
        `Invalid path for scriptmate.customCommandsPath: "${configPath}". Path must be absolute. Using default location.`,
      );
      this._customCommandsJsonPath = this.getDefaultCommandsPath();
    } else {
      // No custom path set, use default and auto-populate the setting
      this._customCommandsJsonPath = this.getDefaultCommandsPath();
      this.autoPopulateDefaultPath();
    }
    console.log(
      "ScriptMate: Custom commands path resolved to:",
      this._customCommandsJsonPath,
    );
  }

  private getDefaultCommandsPath(): string {
    return path.join(
      this.context.globalStorageUri.fsPath,
      SCRIPTMATE_COMMANDS_JSON,
    );
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
      this._onDidChangeCommands.fire({ type: "commandsChanged" });
      return;
    }

    try {
      let fileContent: string;
      fileContent = await fs.promises.readFile(
        this._customCommandsJsonPath,
        "utf-8",
      );

      if (fileContent.trim() === "") {
        this._commands = [];
      } else {
        const parsed = JSON.parse(fileContent) as ScriptDefinition[];
        // Basic validation (can be expanded)
        if (
          !Array.isArray(parsed) ||
          !parsed.every((cmd) => cmd.id && cmd.command)
        ) {
          this._commands = [];
          throw new Error(
            `Commands file ${this._customCommandsJsonPath} contains invalid data.`,
          );
        } else {
          this._commands = parsed.map(normalizeScriptDefinition);
        }
      }
    } catch (err: any) {
      this._commands = [];
      if (err.code === "ENOENT") {
        this._commands = [];
        this._onDidChangeCommands.fire({ type: "commandsChanged" });
        console.error(
          `ScriptMate: Commands file not found at ${this._customCommandsJsonPath}. Starting with empty list.`,
        );
        err.message = `Commands file not found at ${this._customCommandsJsonPath}. Starting with empty list.`;
      }
      throw new Error(
        `Failed to load commands: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    this._onDidChangeCommands.fire({ type: "commandsChanged" });
  }

  /**
   * Reload commands from the configured JSON path (re-resolving the path first)
   * and reconcile shell profile aliases with the loaded list.
   */
  public async syncFromFile(): Promise<{
    commandCount: number;
    aliasCount: number;
  }> {
    this.resolveCustomCommandsPath();
    await this.loadCommands();
    await syncAllShellAliases(this.context, this._commands);
    const aliasCount = this._commands.filter((c) =>
      Boolean(c.shellAlias?.trim()),
    ).length;
    return { commandCount: this._commands.length, aliasCount };
  }

  private async saveCommands(): Promise<void> {
    if (!this._customCommandsJsonPath) {
      vscode.window.showErrorMessage(
        "ScriptMate: Cannot save commands, path is not set.",
      );
      return;
    }
    try {
      const dir = path.dirname(this._customCommandsJsonPath);
      await fs.promises.mkdir(dir, { recursive: true });
      const jsonContent = JSON.stringify(this._commands, null, 2);
      await fs.promises.writeFile(
        this._customCommandsJsonPath,
        jsonContent,
        "utf-8",
      );
    } catch (error) {
      throw new Error(
        `Error saving ScriptMate commands to ${this._customCommandsJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  public async addCommand(command: ScriptDefinition): Promise<void> {
    const normalized = normalizeScriptDefinition(command);
    if (this._commands.some((c) => c.id === normalized.id)) {
      throw new Error(`Command with ID '${normalized.id}' already exists.`);
    }
    const validationError = validateScriptDefinitionForPersistence(
      normalized,
      this._commands,
    );
    if (validationError) {
      throw new Error(validationError);
    }
    const shellAliasError = normalized.shellAlias
      ? await validateShellAliasForRc(this.context, normalized.shellAlias)
      : null;
    if (shellAliasError) {
      throw new Error(shellAliasError);
    }
    this._commands.push(normalized);
    await this.saveCommands();
    this._onDidChangeCommands.fire({
      type: "commandAdded",
      payload: normalized,
    });
    await syncShellAliasTransition(this.context, undefined, normalized);
  }

  public async updateCommand(updatedCommand: ScriptDefinition): Promise<void> {
    const index = this._commands.findIndex((c) => c.id === updatedCommand.id);
    if (index === -1) {
      throw new Error(
        `Command with ID '${updatedCommand.id}' not found for update.`,
      );
    }
    const previous = this._commands[index];
    const normalized = normalizeScriptDefinition(updatedCommand);
    const validationError = validateScriptDefinitionForPersistence(
      normalized,
      this._commands,
    );
    if (validationError) {
      throw new Error(validationError);
    }
    const shellAliasError = normalized.shellAlias
      ? await validateShellAliasForRc(this.context, normalized.shellAlias)
      : null;
    if (shellAliasError) {
      throw new Error(shellAliasError);
    }
    this._commands[index] = normalized;
    await this.saveCommands();
    this._onDidChangeCommands.fire({
      type: "commandUpdated",
      payload: normalized,
    });
    await syncShellAliasTransition(this.context, previous, normalized);
  }

  public async deleteCommand(commandId: string): Promise<void> {
    const removed = this._commands.find((c) => c.id === commandId);
    const initialLength = this._commands.length;
    this._commands = this._commands.filter((c) => c.id !== commandId);
    if (this._commands.length === initialLength) {
      throw new Error(`Command with ID '${commandId}' not found for deletion.`);
    }
    await this.saveCommands();
    this._onDidChangeCommands.fire({
      type: "commandDeleted",
      payload: commandId,
    });
    await syncShellAliasTransition(this.context, removed, undefined);
  }

  private async autoPopulateDefaultPath(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("scriptmate");
      await config.update(
        "customCommandsPath",
        this._customCommandsJsonPath,
        vscode.ConfigurationTarget.Global,
      );
      console.log(
        "ScriptMate: Auto-populated customCommandsPath setting with default:",
        this._customCommandsJsonPath,
      );
    } catch (error) {
      console.warn(
        "ScriptMate: Failed to auto-populate customCommandsPath setting:",
        error,
      );
      vscode.window.showErrorMessage(
        `ScriptMate: Failed to auto-populate default path. ${error}`,
      );
    }
  }
}
