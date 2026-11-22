// §12.3 Anti-nuke — audit log event handler.
import { client } from "../../client.js";
import { Events, Role } from "discord.js";
import { prisma } from "@modest/db";
import { AntiNukeRepository } from "./repository.js";
import { parseAuditLogAction, parseConfig, shouldAct, isWhitelisted } from "./service.js";

function getRedisUrl(): string | undefined {
  return process.env["REDIS_URL"];
}

client.on(Events.GuildAuditLogEntryCreate, async (entry) => {
  const { executor, action, extra } = entry;
  if (!executor) return;

  const guild = (entry as any).guild;
  if (!guild) return;

  const guildId = guild.id;
  const executorId = executor.id;

  const actionGroup = parseAuditLogAction(String(action), extra as Record<string, unknown> | null);
  if (!actionGroup) return;

  const redisUrl = getRedisUrl();
  if (!redisUrl) return;

  const repo = new AntiNukeRepository({ redisUrl });

  const configRow = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true },
  });
  const overrides = (configRow?.overrides as Record<string, unknown> | undefined) ?? {};
  const config = parseConfig(overrides);

  if (isWhitelisted(executorId, guild.ownerId, config.trustedUsers)) return;

  // Record this action and check threshold
  await repo.recordNukeAction(guildId, executorId, actionGroup, Date.now());
  const count = await repo.getNukeCount(guildId, executorId, actionGroup);

  if (!shouldAct(count, config.threshold, false, false)) return;

  // §12.3 Threshold breached — remove dangerous roles from executor, kick if bot, alert owner
  try {
    const member = guild.members.cache.get(executorId);
    if (member) {
      const dangerousRoles = member.roles.cache.filter(
        (r: Role): r is Role & { permissions: { has: (perm: string) => boolean } } => {
          const perms = r.permissions;
          return (
            perms.has("Administrator") ||
            perms.has("BanMembers") ||
            perms.has("KickMembers") ||
            perms.has("ManageGuild") ||
            perms.has("ManageRoles") ||
            perms.has("ManageWebhooks")
          );
        },
      );
      if (dangerousRoles.size > 0) {
        await member.roles.remove(Array.from(dangerousRoles.keys()), "Anti-nuke: destructive action threshold breached");
      }
    }
    if (executor.bot) {
      await guild.members.kick(executorId, "Anti-nuke: bot added by non-owner exceeded threshold");
    }
  } catch {
    // Role removal / kick failed; continue to alert
  }

  // Alert owner by DM + mod-log
  try {
    const owner = await client.users.fetch(guild.ownerId);
    await owner.send(
      `🚨 **Anti-nuke alert** in **${guild.name}**: ${executor.tag} performed ${count} ${actionGroup} actions in 60 seconds (threshold ${config.threshold}). Dangerous roles removed.`,
    );
  } catch {
    // DM failed; continue
  }
});
