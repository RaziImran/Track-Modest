// §12.2 Verification commands.
import {
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../core/reply.js";
import { prisma } from "@modest/db";
import { VerificationService } from "./service.js";

export const verifySetupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Configure verification gate for new members.")
    .setDescriptionLocalizations(localizationsFor("verify"))
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up verification: create Unverified role and #verify channel.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show current verification configuration.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("mode")
        .setDescription("Set verification mode.")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setRequired(true)
            .addChoices(
              { name: "Off", value: "off" },
              { name: "New accounts only", value: "new_accounts" },
              { name: "Everyone", value: "everyone" },
              { name: "Everyone + captcha", value: "everyone_captcha" },
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("minage")
        .setDescription("Set minimum account age in days for new_accounts mode.")
        .addIntegerOption((opt) =>
          opt.setName("days").setRequired(true).setMinValue(1).setMaxValue(365)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("kickafter")
        .setDescription("Kick unverified members after N minutes (null to disable).")
        .addIntegerOption((opt) =>
          opt.setName("minutes").setRequired(true).setMinValue(0).setMaxValue(10080)
        )
    ),
  module: "moderation",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("verification:error.notInServer"));
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const overrides = (await prisma.guildConfig.findUnique({
      where: { guildId: guild.id },
      select: { overrides: true },
    }))?.overrides as Record<string, unknown> | undefined;

    if (subcommand === "status") {
      const config = VerificationService.parseConfig(overrides);
      const embed = new EmbedBuilder()
        .setTitle(t("verification:status:title"))
        .setColor(COLORS.info)
        .setTimestamp()
        .addFields(
          { name: t("verification:status:mode"), value: config.mode, inline: true },
          { name: t("verification:status:minAge"), value: String(config.minAccountAgeDays), inline: true },
          { name: t("verification:status:kickAfter"), value: config.kickAfterMinutes === null ? t("verification:status:disabled") : `${config.kickAfterMinutes} min`, inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === "mode") {
      const mode = interaction.options.getString("mode", true);
      await prisma.guildConfig.upsert({
        where: { guildId: guild.id },
        update: {
          overrides: {
            ...overrides,
            ["verify.mode"]: mode,
          },
        },
        create: {
          guildId: guild.id,
          overrides: { ["verify.mode"]: mode },
        },
      });
      await interaction.reply({
        content: t("verification:mode:set", { mode }),
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "minage") {
      const days = interaction.options.getInteger("days", true);
      await prisma.guildConfig.upsert({
        where: { guildId: guild.id },
        update: {
          overrides: {
            ...overrides,
            ["verify.minAccountAgeDays"]: days,
          },
        },
        create: {
          guildId: guild.id,
          overrides: { ["verify.minAccountAgeDays"]: days },
        },
      });
      await interaction.reply({
        content: t("verification:minage:set", { days }),
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "kickafter") {
      const minutes = interaction.options.getInteger("minutes", true);
      await prisma.guildConfig.upsert({
        where: { guildId: guild.id },
        update: {
          overrides: {
            ...overrides,
            ["verify.kickAfterMinutes"]: minutes === 0 ? null : minutes,
          },
        },
        create: {
          guildId: guild.id,
          overrides: { ["verify.kickAfterMinutes"]: minutes === 0 ? null : minutes },
        },
      });
      await interaction.reply({
        content: t("verification:kickafter:set", { minutes: minutes === 0 ? "disabled" : String(minutes) }),
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "setup") {
      // Create or find Unverified role
      let unverifiedRole = guild.roles.cache.find((r: any) => r.name === "Unverified");
      if (!unverifiedRole) {
        try {
          unverifiedRole = await guild.roles.create({
            name: "Unverified",
            color: 0x808080,
            reason: "Verification gate: Unverified role",
          });
        } catch {
          await interaction.reply({ content: t("verification:setup:roleFailed"), ephemeral: true });
          return;
        }
      }

      // Create or find #verify channel
      let verifyChannel = guild.channels.cache.find(
        (c: any) => c.name === "verify" && c.type === ChannelType.GuildText,
      );
      if (!verifyChannel) {
        try {
          verifyChannel = await guild.channels.create({
            name: "verify",
            type: ChannelType.GuildText,
            reason: "Verification gate: verification channel",
          });
        } catch {
          await interaction.reply({ content: t("verification:setup:channelFailed"), ephemeral: true });
          return;
        }
      }
      // Set permissions: Unverified can only see #verify
      try {
        await verifyChannel.permissionOverwrites.create(unverifiedRole, {
          ViewChannel: true,
          SendMessages: true,
        });
        // Deny ViewChannel for Unverified on all other channels
        for (const [, channel] of guild.channels.cache) {
          if (channel.id === verifyChannel.id) continue;
          if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
            try {
              await channel.permissionOverwrites.create(unverifiedRole, {
                ViewChannel: false,
              });
            } catch {
              // Best effort
            }
          }
        }
      } catch {
        await interaction.reply({ content: t("verification:setup:permissionsFailed"), ephemeral: true });
        return;
      }

      // Post verification message with Verify button
      const config = VerificationService.parseConfig(overrides);
      const isCaptcha = config.mode === "everyone_captcha";
      const embed = new EmbedBuilder()
        .setTitle(t("verification:setup:verifyTitle"))
        .setDescription(
          config.mode === "everyone_captcha"
            ? t("verification:setup:verifyDescCaptcha")
            : t("verification:setup:verifyDesc")
        )
        .setColor(COLORS.info)
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify:${isCaptcha ? "captcha" : "button"}:${guild.id}`)
          .setLabel(isCaptcha ? t("verification:setup:btnCaptcha") : t("verification:setup:btnVerify"))
          .setStyle(ButtonStyle.Primary)
      );

      try {
        await (verifyChannel as any).send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: t("verification:setup:done", { channel: verifyChannel.toString() }), ephemeral: true });
      } catch {
        await interaction.reply({ content: t("verification:setup:messageFailed"), ephemeral: true });
      }
      return;
    }

    await interaction.reply({ content: t("verification:error.unknownSubcommand"), ephemeral: true });
  },
};
