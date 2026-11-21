import { Events } from "discord.js";
import { client } from "../client.js";
import { handleMessageUpdate } from "../modules/logging/events/messageUpdate.js";

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (oldMessage.partial) {
    try {
      await oldMessage.fetch();
    } catch {
      return;
    }
  }
  if (newMessage.partial) {
    try {
      await newMessage.fetch();
    } catch {
      return;
    }
  }
  await handleMessageUpdate(oldMessage, newMessage);
});