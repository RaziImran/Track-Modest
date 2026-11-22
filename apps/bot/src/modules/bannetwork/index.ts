// §15.5 Shared ban network — Discord event handlers.
// Enforces the join action (alert / require_verification / ban) for users
// that are actively listed in the shared ban network.
import { client } from "../../client.js";
import { Events } from "discord.js";
import { BanNetworkRepository } from "./repository.js";
import { BanNetworkService } from "./service.js";

const repo = new BanNetworkRepository({});
const service = new BanNetworkService(BanNetworkRepository.createServiceDeps(repo));

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const enabled = await service.deps.isNetworkEnabled(guildId);
  if (!enabled) return;

  const entry = await service.findListedUser(member.user.id);
  if (!entry) return;

  const action = await service.deps.getJoinAction(guildId);
  if (action === "ban") {
    try {
      await member.ban({ reason: "Listed in shared ban network" });
    } catch {
      // Ban failed (permissions, hierarchy, etc.); continue without failing the join handler.
    }
  }
  // "alert" and "require_verification" are log/signal actions; no immediate
  // enforcement is applied here. Verification gating is handled by the
  // verification module on join.
});
