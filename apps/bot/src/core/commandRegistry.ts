import type { BotCommand } from "@modest/shared";

export interface CommandRegistryEntry {
  command: BotCommand;
  filePath: string;
}

const commands = new Map<string, CommandRegistryEntry>();

export function registerCommand(command: BotCommand, filePath: string): void {
  const name = command.data.name;
  if (!name) {
    throw new Error(`Command at ${filePath} has no name`);
  }
  commands.set(name, { command, filePath });
}

export function getCommand(name: string): CommandRegistryEntry | undefined {
  return commands.get(name);
}

export function getAllCommands(): CommandRegistryEntry[] {
  return Array.from(commands.values());
}

export function clearCommands(): void {
  commands.clear();
}
