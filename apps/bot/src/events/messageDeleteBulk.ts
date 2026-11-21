import { Events } from "discord.js";
import { client } from "../client.js";
import { handleMessageDeleteBulk } from "../modules/logging/events/messageDeleteBulk.js";

client.on(Events.MessageBulkDelete, async (messages) => {
  await handleMessageDeleteBulk(messages);
});