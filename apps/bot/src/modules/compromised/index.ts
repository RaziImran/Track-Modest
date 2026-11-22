// §20.6 Compromised account detection — message event handler.
import { client } from "../../client.js";
import { Events } from "discord.js";
import { prisma } from "@modest/db";
import { CompromisedRepository } from "./repository.js";
import {
  parseConfig,
  isTrustedOrLegend,
  hashLink,
  extractLinks,
  shouldFlagCompromised,
} from "./service.js";

function getRedisUrl(): string | undefined {
  return process.env["REDIS_URL"];
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const redisUrl = getRedisUrl();
  if (!redisUrl) return;

  const configRow = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true },
  });
  const overrides = (configRow?.overrides as Record<string, unknown> | undefined) ?? {};
  const config = parseConfig(overrides);

  if (!config.enabled) return;

  const member = message.guild.members.cache.get(userId);
  if (!member) return;

  // Get member's rep from DB
  const dbMember = await prisma.member.findUnique({
    where: { guildId_userId: { guildId, userId } },
    select: { rep: true },
  });
  const rep = dbMember?.rep ?? 0;

  // Only check Trusted/Legend members (rep >= 2000)
  if (!isTrustedOrLegend(rep)) return;

  const links = extractLinks(message.content);
  if (links.length === 0) return;

  const repo = new CompromisedRepository({ redisUrl });
  const ttlSec = 3600; // track links for 1 hour

  for (const link of links) {
    const linkHash = hashLink(link);
    const channels = await repo.recordLink(guildId, userId, linkHash, message.channel.id, ttlSec);

    if (shouldFlagCompromised(channels.length, config.threshold)) {
      // §20.6 Compromised: delete messages, timeout 1h, DM warning, no rep penalty
      try {
        // Delete recent messages from this user containing this link
        const messages = await message.channel.messages.fetch({ limit: 50 });
        const toDelete = messages.filter(
          (m) => m.author.id === userId && extractLinks(m.content).some((l) => hashLink(l) === linkHash),
        );
        if (toDelete.size > 0 && message.channel.isTextBased()) {
          await (message.channel as any).bulkDelete(toDelete, true);
        }
      } catch {
        // Delete failed; continue
      }

      try {
        const guildMember = await message.guild.members.fetch(userId);
        await guildMember.timeout(config.timeoutMinutes * 60 * 1000, "Account may be compromised");
      } catch {
        // Timeout failed; continue
      }

      try {
        await message.author.send(
          "Your account may be compromised — change your password and enable 2FA.",
        );
      } catch {
        // DM failed; continue
      }

      // Clear link tracking for this user
      await repo.clearUserLinks(guildId, userId);
      return;
    }
  }
});
