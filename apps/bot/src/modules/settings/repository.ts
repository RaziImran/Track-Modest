import { prisma } from "@modest/db";
import type { Strictness, SizeTier } from "@modest/config-engine";

export interface GuildConfigRow {
  sizeTier: SizeTier;
  sizeTierLocked: boolean;
  strictness: Strictness;
  modules: Record<string, boolean>;
  overrides: Record<string, unknown>;
  channelOverrides: Record<string, unknown>;
  staffRoles: Record<string, string[]>;
  logChannels: Record<string, string>;
  modLogChannelId: string | null;
}

export async function getGuildConfig(
  guildId: string,
): Promise<GuildConfigRow | null> {
  const row = await prisma.guildConfig.findUnique({
    where: { guildId },
    include: { guild: true },
  });
  if (!row) return null;
  return {
    sizeTier: row.sizeTier as SizeTier,
    sizeTierLocked: row.sizeTierLocked,
    strictness: row.strictness as Strictness,
    modules: (row.modules as Record<string, boolean>) ?? {},
    overrides: (row.overrides as Record<string, unknown>) ?? {},
    channelOverrides: (row.channelOverrides as Record<string, unknown>) ?? {},
    staffRoles: (row.staffRoles as Record<string, string[]>) ?? {},
    logChannels: (row.logChannels as Record<string, string>) ?? {},
    modLogChannelId: row.modLogChannelId,
  };
}

export async function setOverride(
  guildId: string,
  path: string,
  value: unknown,
): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      overrides: {
        ...(await getOverrides(guildId)),
        [path]: value,
      } as any,
    },
    create: {
      guildId,
      overrides: { [path]: value } as any,
      modules: {},
      staffRoles: {},
      logChannels: {},
      sizeTier: "SMALL",
      strictness: "BALANCED",
    },
  });
}

async function getOverrides(guildId: string): Promise<Record<string, unknown>> {
  const row = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true },
  });
  return (row?.overrides as Record<string, unknown>) ?? {};
}

export async function removeOverride(
  guildId: string,
  path: string,
): Promise<void> {
  const overrides = await getOverrides(guildId);
  const { [path]: _removed, ...rest } = overrides;
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { overrides: rest as any },
    create: {
      guildId,
      overrides: {},
      modules: {},
      staffRoles: {},
      logChannels: {},
      sizeTier: "SMALL",
      strictness: "BALANCED",
    },
  });
}

export async function toggleModule(
  guildId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  const row = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { modules: true },
  });
  const modules = (row?.modules as Record<string, boolean>) ?? {};
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      modules: { ...modules, [moduleKey]: enabled } as any,
    },
    create: {
      guildId,
      modules: { [moduleKey]: enabled } as any,
      overrides: {},
      staffRoles: {},
      logChannels: {},
      sizeTier: "SMALL",
      strictness: "BALANCED",
    },
  });
}

export async function setSizeTier(
  guildId: string,
  sizeTier: SizeTier,
  locked: boolean,
): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { sizeTier, sizeTierLocked: locked },
    create: {
      guildId,
      sizeTier,
      sizeTierLocked: locked,
      strictness: "BALANCED",
      modules: {},
      overrides: {},
      staffRoles: {},
      logChannels: {},
    },
  });
}

export async function setStrictness(
  guildId: string,
  strictness: Strictness,
): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { strictness },
    create: {
      guildId,
      strictness,
      sizeTier: "SMALL",
      modules: {},
      overrides: {},
      staffRoles: {},
      logChannels: {},
    },
  });
}

export interface ConfigHistoryRow {
  id: number;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  actorId: string;
  source: string;
  createdAt: Date;
}

export async function recordConfigChange(
  guildId: string,
  actorId: string,
  source: string,
  path: string,
  oldValue?: unknown,
  newValue?: unknown,
): Promise<ConfigHistoryRow> {
  const row = await prisma.configHistory.create({
    data: {
      guildId,
      actorId,
      source,
      path,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    } as any,
  });
  return {
    id: row.id,
    path: row.path,
    oldValue: row.oldValue,
    newValue: row.newValue,
    actorId: row.actorId,
    source: row.source,
    createdAt: row.createdAt,
  };
}

export async function getConfigHistory(
  guildId: string,
  limit = 25,
): Promise<ConfigHistoryRow[]> {
  const rows = await prisma.configHistory.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    oldValue: r.oldValue,
    newValue: r.newValue,
    actorId: r.actorId,
    source: r.source,
    createdAt: r.createdAt,
  }));
}
