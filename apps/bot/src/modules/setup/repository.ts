import { prisma } from "@modest/db";
import type { SetupState } from "./schemas.js";

const SETUP_STATE_TTL_SEC = 60 * 30; // 30 minutes

export async function getSetupState(
  guildId: string,
  userId: string,
): Promise<SetupState | null> {
  const row = await prisma.setupWizardState.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (!row) return null;
  return JSON.parse(row.stateJson as unknown as string) as SetupState;
}

export async function setSetupState(
  guildId: string,
  userId: string,
  state: SetupState,
  _ttlSec = SETUP_STATE_TTL_SEC,
): Promise<void> {
  await prisma.setupWizardState.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { stateJson: JSON.stringify(state), updatedAt: new Date() },
    create: { guildId, userId, stateJson: JSON.stringify(state) },
  });
}

export async function deleteSetupState(
  guildId: string,
  userId: string,
): Promise<void> {
  await prisma.setupWizardState.deleteMany({
    where: { guildId, userId },
  });
}

export async function ensureGuildAndConfig(
  guildId: string,
  guildName: string,
  ownerId: string,
): Promise<void> {
  await prisma.guild.upsert({
    where: { id: guildId },
    update: { name: guildName },
    create: { id: guildId, name: guildName, ownerId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
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
}

export async function applySetupConfig(
  guildId: string,
  actorId: string,
  config: {
    locale: string;
    sizeTier: string;
    sizeTierLocked: boolean;
    strictness: string;
    staffRoles: Record<string, string[]>;
    modLogChannelId: string | undefined;
    logChannels: Record<string, string>;
    modules: Record<string, boolean>;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update Guild
    await tx.guild.update({
      where: { id: guildId },
      data: {
        locale: config.locale,
        setupComplete: true,
      },
    });

    // Update GuildConfig
    await tx.guildConfig.update({
      where: { guildId },
      data: {
        sizeTier: config.sizeTier as any,
        sizeTierLocked: config.sizeTierLocked,
        strictness: config.strictness as any,
        modules: config.modules,
        staffRoles: config.staffRoles,
        logChannels: config.logChannels,
        modLogChannelId: config.modLogChannelId,
      },
    });

    // Write ConfigHistory rows
    const historyRows = [
      { path: "locale", oldValue: null, newValue: config.locale },
      { path: "sizeTier", oldValue: null, newValue: config.sizeTier },
      { path: "sizeTierLocked", oldValue: null, newValue: config.sizeTierLocked },
      { path: "strictness", oldValue: null, newValue: config.strictness },
      { path: "modules", oldValue: null, newValue: config.modules },
      { path: "staffRoles", oldValue: null, newValue: config.staffRoles },
      { path: "modLogChannelId", oldValue: null, newValue: config.modLogChannelId },
      { path: "logChannels", oldValue: null, newValue: config.logChannels },
    ];

    for (const row of historyRows) {
      await tx.configHistory.create({
        data: {
          guildId,
          actorId,
          source: "wizard",
          path: row.path,
          oldValue: (row.oldValue as any) ?? null,
          newValue: row.newValue,
        },
      });
    }
  });
}
