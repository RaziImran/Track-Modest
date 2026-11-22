import http from "node:http";
import { registerCommand } from "./core/commandRegistry.js";
import { pingCommand } from "./commands/ping.js";
import { buildHealthReport } from "./core/health.js";
import { metricsText } from "./core/metrics.js";
import { runGracefulShutdown } from "./core/gracefulShutdown.js";
import "./modules/moderation/index.js";
import "./modules/config/index.js";
import "./modules/logging/index.js";
import "./modules/hub/index.js";
import "./modules/antiraid/index.js";
import "./modules/verification/index.js";
import "./modules/antinuke/index.js";
import "./modules/compromised/index.js";
import "./modules/risk/index.js";
import "./modules/reviewqueue/index.js";
import "./modules/raidprediction/index.js";
import "./modules/shadowmode/index.js";
import "./modules/bannetwork/index.js";
import "./events/messageUpdate.js";
import "./events/messageDelete.js";
import "./events/messageDeleteBulk.js";
import "./events/guildMemberAdd.js";
import "./events/guildMemberRemove.js";
import "./events/guildMemberUpdate.js";
import "./events/guildMemberRoleUpdate.js";
import "./events/guildChannelCreate.js";
import "./events/guildChannelDelete.js";
import "./events/guildChannelUpdate.js";
import "./events/guildVoiceStateUpdate.js";
import "./events/inviteCreate.js";
import "./events/inviteDelete.js";
import "./events/guildUpdate.js";
import "./events/guildEmojiUpdate.js";

registerCommand(pingCommand, import.meta.url);

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    const report = buildHealthReport(true, true, true);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(report));
    return;
  }
  if (req.url === "/metrics") {
    res.setHeader("content-type", "text/plain; version=0.0.4");
    res.end(await metricsText());
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

server.listen(Number(process.env["PORT"] ?? 3000));

const shutdown = async () => {
  await runGracefulShutdown({
    stopAcceptingInteractions: () => {},
    finishInFlight: async () => {},
    closeConnections: async () => {
      server.close();
    },
  });
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { client } from "./client.js";
