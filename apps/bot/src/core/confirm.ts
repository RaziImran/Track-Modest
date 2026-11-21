import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export interface ConfirmHandlers {
  onConfirm: () => unknown;
  onCancel: () => unknown;
}

interface ConfirmMessage {
  createMessageComponentCollector: (options: { time?: number }) => ConfirmCollector;
}

interface ConfirmCollector {
  on: (event: "collect" | "end", handler: (interaction: unknown) => void) => void;
  stop: () => void;
}

export interface ConfirmInteraction {
  reply: (options: {
    content?: string;
    components?: unknown[];
    ephemeral?: boolean;
    fetchReply?: boolean;
  }) => Promise<ConfirmMessage>;
}

export async function createConfirm(
  interaction: ConfirmInteraction,
  message: string,
  handlers: ConfirmHandlers,
  timeoutSec = 60,
): Promise<boolean> {
  const confirmButton = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  const sent = await interaction.reply({
    content: message,
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  const collector = sent.createMessageComponentCollector({ time: timeoutSec * 1000 });

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        collector.stop();
        resolve(value);
      }
    };

    collector.on("collect", (i: unknown) => {
      const customId = (i as { customId?: string })?.customId;
      if (customId === "confirm") {
        handlers.onConfirm();
        settle(true);
      } else if (customId === "cancel") {
        handlers.onCancel();
        settle(false);
      }
    });

    collector.on("end", () => {
      settle(false);
    });
  });
}
