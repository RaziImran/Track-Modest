import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { localizationsFor } from "@modest/i18n";
import type { BotCommand, CommandContext } from "@modest/shared";
import { COLORS } from "../../../core/reply.js";

function getCfg(cfg: any, key: string, fallback: unknown): unknown {
  if (!cfg) return fallback;
  const value = cfg[key];
  return value === undefined ? fallback : value;
}

function rolePermsMissingText(perms: bigint): string {
  const names: string[] = [];
  const checks: [bigint, string][] = [
    [BigInt(0x8), "Administrator"],
    [BigInt(0x20), "Manage Server"],
    [BigInt(0x10), "Manage Roles"],
    [BigInt(0x4), "Ban Members"],
    [BigInt(0x2), "Kick Members"],
    [BigInt(0x40000), "Mention Everyone"],
  ];
  for (const [bit, name] of checks) {
    if ((perms & bit) === bit) names.push(name);
  }
  return names.length > 0 ? names.join(", ") : "none";
}

function permBit(name: string): bigint | undefined {
  const map: Record<string, bigint> = {
    Administrator: BigInt(0x8),
    "Manage Server": BigInt(0x20),
    "Manage Roles": BigInt(0x10),
    "Ban Members": BigInt(0x4),
    "Kick Members": BigInt(0x2),
    "Manage Messages": BigInt(0x1000),
    "Manage Webhooks": BigInt(0x100000),
    "View Audit Log": BigInt(0x40),
    "Mention Everyone": BigInt(0x40000),
    "View Channel": BigInt(0x400),
  };
  return map[name];
}

type CheckResult = {
  key: string;
  severity: "critical" | "high" | "medium";
  passed: boolean;
  detail: string;
  fixable: boolean;
  fixLabel?: string;
  fixCustomId?: string;
};

const SEVERITY_ORDER: Record<string, number> = { critical: 3, high: 2, medium: 1 };

export const checkpermsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("checkperms")
    .setDescription("Permission Doctor: audit bot permissions and server security.")
    .setDescriptionLocalizations(localizationsFor("checkperms")),
  module: "moderation",
  staffLevel: "admin",
  defer: "ephemeral",
  async execute(ctx: CommandContext): Promise<void> {
    const interaction = ctx.interaction as any;
    const cfg = ctx.config as any;
    const t = ctx.t as (key: string, params?: Record<string, unknown>) => string;
    const guild = interaction.guild;
    if (!guild) {
      await ctx.error(ctx.t("moderation:checkperms:error.notInServer"));
      return;
    }

    const botMember = guild.members.me;
    const everyoneRole = guild.roles.everyone;
    const configStaffRoles = (getCfg(cfg, "staffRoles", {}) as Record<string, string[]>) ?? {};

    const checks: CheckResult[] = [];

    // 1. Bot missing permissions needed for enabled modules
    const enabledModules = (cfg?.modules as Record<string, boolean> | undefined) ?? {};
    const neededPerms = new Set<string>();
    if (enabledModules["moderation"]) {
      neededPerms.add("Kick Members");
      neededPerms.add("Ban Members");
      neededPerms.add("Manage Roles");
      neededPerms.add("Manage Messages");
    }
    if (enabledModules["logging"]) {
      neededPerms.add("Manage Webhooks");
      neededPerms.add("View Audit Log");
    }
    if (enabledModules["automod"]) {
      neededPerms.add("Manage Messages");
    }

    const botMissing = [...neededPerms].filter((p) => {
      const bit = permBit(p);
      return bit !== undefined && (botMember?.permissions.bit & bit) !== bit;
    });
    checks.push({
      key: "checkperms:check.botMissingPerms",
      severity: "critical",
      passed: botMissing.length === 0,
      detail: botMissing.length > 0 ? botMissing.join(", ") : t("moderation:checkperms:detail.allGood"),
      fixable: false,
    });

    // 2. Bot's role below staff/member roles it must moderate
    const staffRoleIds = new Set<string>();
    for (const ids of Object.values(configStaffRoles)) {
      for (const id of ids) staffRoleIds.add(id);
    }
    let lowestStaffRole = guild.roles.everyone;
    for (const roleId of staffRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role && role.position > lowestStaffRole.position) {
        lowestStaffRole = role;
      }
    }
    const botRoleBelowStaff =
      lowestStaffRole !== guild.roles.everyone &&
      botMember &&
      lowestStaffRole.position >= botMember.roles.highest.position;
    checks.push({
      key: "checkperms:check.botRoleBelowStaff",
      severity: "critical",
      passed: !botRoleBelowStaff,
      detail: botRoleBelowStaff
        ? t("moderation:checkperms:detail.roleBelowStaff", {
            role: lowestStaffRole.name,
            botRole: botMember?.roles.highest.name ?? "?",
          })
        : t("moderation:checkperms:detail.allGood"),
      fixable: false,
    });

    // 3. @everyone has dangerous permissions
    const everyonePerms = everyoneRole.permissions;
    const everyoneDangerous = rolePermsMissingText(everyonePerms);
    const everyoneHasDangerous = everyoneDangerous !== "none";
    checks.push({
      key: "checkperms:check.everyoneDangerousPerms",
      severity: "critical",
      passed: !everyoneHasDangerous,
      detail: everyoneHasDangerous
        ? t("moderation:checkperms:detail.everyoneDangerous", { perms: everyoneDangerous })
        : t("moderation:checkperms:detail.allGood"),
      fixable: everyoneHasDangerous,
      fixLabel: t("moderation:checkperms:fix.removeFromEveryone"),
      fixCustomId: `mod:checkperms:fix:everyone:${guild.id}`,
    });

    // 4. A role with many members has Administrator
    let adminRole: { id: string; name: string; memberCount: number } | null = null;
    for (const role of guild.roles.cache.values()) {
      if (role.id === everyoneRole.id) continue;
      if ((role.permissions.bit & BigInt(0x8)) !== BigInt(0x8)) continue;
      const memberCount = role.members.size;
      if (memberCount > 0 && (!adminRole || memberCount > adminRole.memberCount)) {
        adminRole = { id: role.id, name: role.name, memberCount };
      }
    }
    checks.push({
      key: "checkperms:check.roleWithAdmin",
      severity: "high",
      passed: adminRole === null,
      detail: adminRole
        ? t("moderation:checkperms:detail.roleWithAdmin", {
            role: adminRole.name,
            count: adminRole.memberCount,
          })
        : t("moderation:checkperms:detail.allGood"),
      fixable: false,
    });

    // 5. Webhooks from departed members in channels bot didn't create
    let departedWebhooks = 0;
    try {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isText()) continue;
        try {
          const webhooks = await channel.fetchWebhooks();
          for (const wh of webhooks.values()) {
            if (wh.ownerId && !guild.members.cache.has(wh.ownerId)) {
              departedWebhooks += 1;
            }
          }
        } catch {
          // channel not accessible, skip
        }
      }
    } catch {
      // skip
    }
    checks.push({
      key: "checkperms:check.departedWebhooks",
      severity: "high",
      passed: departedWebhooks === 0,
      detail: departedWebhooks > 0
        ? t("moderation:checkperms:detail.departedWebhooks", { count: departedWebhooks })
        : t("moderation:checkperms:detail.allGood"),
      fixable: departedWebhooks > 0,
      fixLabel: t("moderation:checkperms:fix.deleteWebhooks"),
      fixCustomId: `mod:checkperms:fix:webhooks:${guild.id}`,
    });

    // 6. Guild 2FA requirement off
    const mfaOff = guild.mfaLevel === 0;
    checks.push({
      key: "checkperms:check.mfaOff",
      severity: "medium",
      passed: !mfaOff,
      detail: mfaOff ? t("moderation:checkperms:detail.mfaOff") : t("moderation:checkperms:detail.allGood"),
      fixable: false,
    });

    // 7. Verification level None for public server
    const verificationNone = guild.verificationLevel === 0;
    checks.push({
      key: "checkperms:check.verificationNone",
      severity: "medium",
      passed: !verificationNone,
      detail: verificationNone
        ? t("moderation:checkperms:detail.verificationNone")
        : t("moderation:checkperms:detail.allGood"),
      fixable: verificationNone,
      fixLabel: t("moderation:checkperms:fix.setVerification"),
      fixCustomId: `mod:checkperms:fix:verification:${guild.id}`,
    });

    // 8. Mod-log channel visible to @everyone
    const modLogChannelId = (getCfg(cfg, "modLogChannelId", undefined) ??
      (cfg?.logChannels as Record<string, string> | undefined)?.["modLog"]) as
      | string
      | undefined;
    let modLogVisible = false;
    if (modLogChannelId) {
      const ch = guild.channels.cache.get(modLogChannelId);
      if (ch) {
        const everyoneOverwrite = ch.permissionOverwrites.cache.get(everyoneRole.id);
        modLogVisible = !everyoneOverwrite || !everyoneOverwrite.deny.has("ViewChannel");
      }
    }
    checks.push({
      key: "checkperms:check.modLogVisible",
      severity: "high",
      passed: !modLogVisible || !modLogChannelId,
      detail: modLogVisible
        ? t("moderation:checkperms:detail.modLogVisible")
        : t("moderation:checkperms:detail.allGood"),
      fixable: modLogVisible && !!modLogChannelId,
      fixLabel: t("moderation:checkperms:fix.hideModLog"),
      fixCustomId: `mod:checkperms:fix:modlog:${guild.id}`,
    });

    // Build embed
    const severityEmoji: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡" };
    const passedCount = checks.filter((c) => c.passed).length;
    const totalCount = checks.length;
    let worstSeverity: keyof typeof SEVERITY_ORDER = "medium";
    for (const c of checks) {
      const cur = SEVERITY_ORDER[c.severity] ?? 0;
      const curWorst = SEVERITY_ORDER[worstSeverity] ?? 0;
      if (cur > curWorst) {
        worstSeverity = c.severity;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(t("moderation:checkperms:title"))
      .setDescription(
        t("moderation:checkperms:summary", {
          passed: passedCount,
          total: totalCount,
          severity: severityEmoji[worstSeverity] ?? "⚪",
        }),
      )
      .setColor(
        worstSeverity === "critical" ? COLORS.error : worstSeverity === "high" ? COLORS.warning : COLORS.success,
      )
      .setTimestamp()
      .setFooter({ text: `Guild: ${guild.id}` });

    for (const c of checks) {
      const status = c.passed ? "✅" : `${severityEmoji[c.severity] ?? "⚪"} ❌`;
      embed.addFields({
        name: `${status} ${t(c.key)}`,
        value: c.detail + (c.fixable ? `\n🔧 ${t(c.fixLabel!)}` : ""),
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
