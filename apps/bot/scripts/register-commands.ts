import { REST } from "@discordjs/rest";
import { Routes } from "discord.js";
import { getAllCommands } from "../src/core/commandRegistry.js";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DEV_GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DEV_GUILD_ID");
    process.exit(1);
  }

  const commands = getAllCommands().map((entry) => entry.command.data.toJSON());

  const rest = new REST().setToken(token);

  try {
    console.log(`Registering ${commands.length} commands to guild ${guildId}...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Commands registered successfully.");
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
}

main();
