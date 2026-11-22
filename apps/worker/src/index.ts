import { loadEnv, createLogger } from "@modest/shared";
import { prisma } from "@modest/db";
import { REST, Routes } from "discord.js";
import { createModerationQueue, createBoostEndQueue } from "./queue.js";
import { createCaseExpireWorker, createBoostEndWorker } from "./worker.js";
import { buildRecoveryDeps, runRecoverySweep } from "./recovery.js";

const logger = createLogger("worker");

async function main(): Promise<void> {
  const env = loadEnv("worker");

  const redisUrl = env.REDIS_URL;

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN ?? "");

  const performExpiry = async (params: {
    type: "TEMPBAN" | "TIMEOUT";
    guildId: string;
    targetId: string;
    reason: string;
  }): Promise<void> => {
    if (params.type === "TEMPBAN") {
      await rest.delete(Routes.guildBan(params.guildId, params.targetId), {
        reason: params.reason,
      });
    } else {
      await rest.put(Routes.guildMember(params.guildId, params.targetId), {
        body: { communication_disabled_until: null },
        reason: params.reason,
      });
    }
  };

  const deps = buildRecoveryDeps(prisma, { performExpiry }, logger);

  const queue = createModerationQueue(redisUrl);
  const worker = createCaseExpireWorker(redisUrl, deps);

  // §8.10 — Worker for boost:end delayed jobs.
  const boostEndQueue = createBoostEndQueue(redisUrl);
  const boostEndWorker = createBoostEndWorker(redisUrl, {
    prisma,
    rest,
    logger,
  });

  logger.info({ service: "worker", event: "starting" }, "Worker starting");

  // §10.7 Recovery sweep on start: expire cases whose jobs were lost.
  const result = await runRecoverySweep(deps);
  logger.info(
    { service: "worker", event: "recovery-sweep" },
    `Recovery sweep complete: ${result.succeeded}/${result.processed} processed`,
  );

  worker.on("failed", (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(
      { service: "worker", event: "job-failed" },
      `Case expire job failed${job?.id ? ` (job ${job.id})` : ""}`,
      error,
    );
  });

  boostEndWorker.on("failed", (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(
      { service: "worker", event: "boost-end-job-failed" },
      `Boost end job failed${job?.id ? ` (job ${job.id})` : ""}`,
      error,
    );
  });

  const shutdown = async (): Promise<void> => {
    logger.info({ service: "worker", event: "shutdown" }, "Shutting down");
    await worker.close();
    await boostEndWorker.close();
    await queue.close();
    await boostEndQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.fatal({ service: "worker", event: "fatal" }, error.message);
  process.exit(1);
});
