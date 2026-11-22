import {
  Events,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Guild,
  TextChannel,
} from "discord.js";
import { client } from "../client.js";
import { prisma } from "@modest/db";
import { setSetupState } from "../modules/setup/repository.js";
import { initialSetupState } from "../modules/setup/schemas.js";
import { COLORS } from "../core/reply.js";

const SETUP_STATE_TTL_SEC = 60 * 30; // 30 minutes

async function findWritableChannel(guild: Guild): Promise<TextChannel | null> {
  const botMember = guild.members.me;
  if (!botMember) return null;
  for (const ch of guild.channels.cache.values()) {
    if (!ch.isTextBased()) continue;
    const textChannel = ch as TextChannel;
    if (textChannel.viewable && textChannel.permissionsFor(botMember)?.has("SendMessages")) {
      return textChannel;
    }
  }
  return null;
}

async function postWelcome(guild: Guild): Promise<void> {
  const target = guild.systemChannel ?? (await findWritableChannel(guild));
  if (!target) return;

  const embed = new EmbedBuilder()
    .setTitle("Track Modest — Server Setup")
    .setDescription(
      "Thanks for adding Track Modest! Let's configure your server in about 60 seconds. " +
      "Click **Start setup** to begin the wizard.",
    )
    .setColor(COLORS.info);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:start:${guild.id}`)
      .setLabel("Start setup")
      .setStyle(ButtonStyle.Primary),
  );

  try {
    await (target as TextChannel).send({ embeds: [embed as any], components: [row as any] });
  } catch {
    // Channel may be inaccessible; continue without failing.
  }

  // DM the owner the same message
  try {
    const owner = await guild.fetchOwner();
    if (owner) {
      await owner.send({ embeds: [embed as any], components: [row as any] });
    }
  } catch {
    // Owner may have DMs disabled; continue without failing.
  }
}

client.on(Events.GuildCreate, async (guild: Guild) => {
  // Create Guild + GuildConfig rows with defaults
  await prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name },
    create: {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      setupComplete: false,
    },
  });

  await prisma.guildConfig.upsert({
    where: { guildId: guild.id },
    update: {},
    create: {
      guildId: guild.id,
      sizeTier: "SMALL",
      sizeTierLocked: false,
      strictness: "BALANCED",
      modules: {},
      overrides: {},
      channelOverrides: {},
      staffRoles: {},
      logChannels: {},
    },
  });

  // Post welcome message with "Start setup" button + DM owner
  await postWelcome(guild);
});

// Handle the "Start setup" button from the welcome message
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("setup:start:")) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Setup must be run in a server.", ephemeral: true });
    return;
  }

  const guildId = customId.split(":", 3)[2];
  if (guildId !== guild.id) {
    await interaction.reply({ content: "Setup guild mismatch.", ephemeral: true });
    return;
  }

  const userId = interaction.user.id;

  await setSetupState(guildId, userId, initialSetupState(), SETUP_STATE_TTL_SEC);

  const locales: string[] = ["en", "es", "pt-BR", "fr", "de", "hi", "ur", "ar", "tr", "id"];
  const localeLabels: Record<string, string> = {
    en: "English",
    es: "Español",
    "pt-BR": "Português (Brasil)",
    fr: "Français",
    de: "Deutsch",
    hi: "हिन्दी",
    ur: "اردو",
    ar: "العربية",
    tr: "Türkçe",
    id: "Bahasa Indonesia",
  };

  const localeSelect = new StringSelectMenuBuilder()
    .setCustomId("setup:select:locale")
    .setPlaceholder("Choose a language")
    .setMinValues(1)
    .setMaxValues(1);

  for (const loc of locales) {
    localeSelect.addOptions([
      {
        label: localeLabels[loc] ?? loc,
        value: loc,
        default: loc === "en",
      },
    ]);
  }

  const embed = new EmbedBuilder()
    .setTitle("Step 1 of 8 — Language")
    .setDescription("Choose your server's language. This affects bot responses and logs.")
    .setColor(COLORS.info);

  await interaction.update({
    embeds: [embed as any],
    components: [
      { type: 1, components: [localeSelect as any] },
      {
        type: 1,
        components: [
          { type: 2, custom_id: "setup:next:1", label: "Next", style: 1 },
          { type: 2, custom_id: "setup:skip:1", label: "Skip", style: 2 },
        ],
      },
    ],
  });
});

export { postWelcome };
