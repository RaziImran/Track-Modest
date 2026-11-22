// §12.1 Anti-raid alert button handlers.
// customId format: antiraid:<action>:<guildId>
// Actions: ban_suspicious, kick_suspicious, end_lockdown, false_alarm
import { client } from "../../client.js";
import { Events } from "discord.js";
import { AntiraidRepository } from "./repository.js";
import { TemporaryBoostService } from "../config/service.js";

function getRedisUrl(): string | undefined {
  return process.env["REDIS_URL"];
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("antiraid:")) return;

  const parts = customId.split(":");
  // antiraid:<action>:<guildId>
  const action = parts[1];
  const guildId = parts[2];
  if (!action || !guildId) return;

  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    await interaction.reply({ content: "This button is not valid for this server.", ephemeral: true });
    return;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    await interaction.reply({ content: "Redis is unavailable.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const repo = new AntiraidRepository({ redisUrl });
  const raidState = await repo.getRaidState(guildId);
  if (!raidState) {
    await interaction.editReply({ content: "No active raid state found. The lockdown may have already ended." });
    return;
  }

  const service = new TemporaryBoostService({
    createTemporaryBoost: async () => ({
      id: 0,
      guildId,
      strictness: "LOCKDOWN",
      reason: "",
      startedBy: "",
      endsAt: new Date(),
      createdAt: new Date(),
    }),
    getActiveTemporaryBoost: async () => null,
    endTemporaryBoost: async () => false,
    scheduleBoostEndJob: async () => "",
    cancelBoostEndJob: async () => {},
  });

  switch (action) {
    case "ban_suspicious": {
      let banned = 0;
      for (const sj of raidState.suspiciousJoiners) {
        try {
          await guild.bans.create(sj.userId, { reason: "Anti-raid: banned suspicious account via mod alert" });
          banned += 1;
        } catch {
          // Ban failed; continue
        }
      }
      await interaction.editReply({
        content: `Banned ${banned} suspicious account(s).`,
      });
      break;
    }

    case "kick_suspicious": {
      let kicked = 0;
      for (const sj of raidState.suspiciousJoiners) {
        const member = guild.members.cache.get(sj.userId);
        if (!member) continue;
        try {
          await member.kick("Anti-raid: kicked suspicious account via mod alert");
          kicked += 1;
        } catch {
          // Kick failed; continue
        }
      }
      await interaction.editReply({
        content: `Kicked ${kicked} suspicious account(s).`,
      });
      break;
    }

    case "end_lockdown": {
      const active = await service.getActiveBoost(guildId);
      if (active) {
        await service.endBoost(guildId);
      }
      if (raidState.prevVerifyLevel !== null) {
        try {
          await guild.setVerificationLevel(raidState.prevVerifyLevel as any);
        } catch {
          // Restore failed; continue
        }
      }
      await repo.clearRaidState(guildId);
      await interaction.editReply({
        content: "Lockdown ended. Verification level restored.",
      });
      break;
    }

    case "false_alarm": {
      const active = await service.getActiveBoost(guildId);
      if (active) {
        await service.endBoost(guildId);
      }
      if (raidState.prevVerifyLevel !== null) {
        try {
          await guild.setVerificationLevel(raidState.prevVerifyLevel as any);
        } catch {
          // Restore failed; continue
        }
      }
      await repo.clearRaidState(guildId);
      await interaction.editReply({
        content: "False alarm. Lockdown ended and verification level restored.",
      });
      break;
    }

    default:
      await interaction.editReply({ content: "Unknown anti-raid action." });
  }
});
