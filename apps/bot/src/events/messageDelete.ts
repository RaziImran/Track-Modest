import { Events } from "discord.js";
import { client } from "../client.js";
import { handleMessageDelete } from "../modules/logging/events/messageDelete.js";

client.on(Events.MessageDelete, async (message) => {
  if (message.partial) {
    try {
      await message.fetch();
    } catch {
      return;
    }
  }
  await handleMessageDelete(message);
});