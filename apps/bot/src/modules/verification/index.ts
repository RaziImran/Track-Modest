// §12.2 Verification — button/modal handlers and guildMemberAdd integration.
// customId formats:
//   verify:button:<guildId>   — remove Unverified role (button verification)
//   verify:captcha:<guildId>  — start captcha flow (generate code, show + modal)
//   verify:captcha:submit:<guildId> — modal submit for captcha code entry
import { client } from "../../client.js";
import { Events, ButtonStyle } from "discord.js";
import { prisma } from "@modest/db";
import { VerificationService } from "./service.js";
import { VerificationRepository } from "./repository.js";

const repo = new VerificationRepository({});
const service = new VerificationService(VerificationRepository.createServiceDeps(repo));

function getVerifyConfig(overrides: Record<string, unknown> | undefined) {
  return VerificationService.parseConfig(overrides);
}

// --- guildMemberAdd: add Unverified role to members who need verification ---
export async function handleGuildMemberAddVerification(member: any): Promise<void> {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const configRow = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { overrides: true, modules: true },
  });
  if (!configRow) return;
  const modules = (configRow.modules as Record<string, boolean> | undefined) ?? {};
  if (!modules["verification"]) return;

  const config = getVerifyConfig(configRow.overrides as Record<string, unknown> | undefined);
  if (config.mode === "off") return;

  const needsVerify = VerificationService.shouldVerify(member, config);
  if (!needsVerify) return;

  // Add Unverified role
  let unverifiedRole = member.guild.roles.cache.find((r: any) => r.name === "Unverified");
  if (!unverifiedRole) {
    try {
      unverifiedRole = await member.guild.roles.create({
        name: "Unverified",
        color: 0x808080,
        reason: "Verification gate: Unverified role",
      });
    } catch {
      return;
    }
  }

  try {
    await member.roles.add(unverifiedRole, "Verification gate: new member needs verification");
  } catch {
    // Role add failed; continue
  }

  // Schedule kick after kickAfterMinutes if set
  if (config.kickAfterMinutes && config.kickAfterMinutes > 0) {
    globalThis.setTimeout(async () => {
      // Re-check: member may have verified by now
      const memberNow = member.guild.members.cache.get(member.id);
      if (!memberNow) return;
      const stillUnverified = memberNow.roles.cache.has(unverifiedRole.id);
      if (!stillUnverified) return;

      const state = await service.deps.getVerificationState(guildId, member.id);
      if (state?.passedAt) return; // already passed

      try {
        await memberNow.kick("Verification gate: did not verify within time limit");
        await service.deps.clearVerificationState(guildId, member.id);
      } catch {
        // Kick failed; continue
      }
    }, config.kickAfterMinutes * 60 * 1000);
  }
}

// --- Button: verify:button:<guildId> — remove Unverified role ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("verify:")) return;

  const parts = customId.split(":");
  // verify:<action>:<guildId>
  const action = parts[1];
  const guildId = parts[2];
  if (!action || !guildId) return;

  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    await interaction.reply({ content: "This button is not valid for this server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = guild.members.cache.get(interaction.user.id);
  if (!member) {
    await interaction.editReply({ content: "You are not a member of this server." });
    return;
  }

  const unverifiedRole = guild.roles.cache.find((r: any) => r.name === "Unverified");
  if (!unverifiedRole || !member.roles.cache.has(unverifiedRole.id)) {
    await interaction.editReply({ content: "You are already verified." });
    return;
  }

  if (action === "button") {
    try {
      await member.roles.remove(unverifiedRole, "Verified via button");
      await service.deps.setVerificationState({
        guildId,
        userId: interaction.user.id,
        method: "button",
        attempts: 0,
        captchaAnswer: null,
        passedAt: new Date(),
      });
      await interaction.editReply({ content: "You are now verified!" });
    } catch {
      await interaction.editReply({ content: "Failed to verify. Please contact a moderator." });
    }
    return;
  }

  if (action === "captcha") {
    await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { overrides: true },
    });

    const code = VerificationService.generateCaptchaCode();
    const hash = VerificationService.hashCaptchaCode(code);

    await service.deps.setVerificationState({
      guildId,
      userId: interaction.user.id,
      method: "captcha",
      attempts: 0,
      captchaAnswer: hash,
      passedAt: null,
    });

    // Show code in ephemeral message (canvas not available; simplified captcha)
    await interaction.editReply({
      content: `Your verification code is: \`${code}\`. Click "Enter code" below to submit it.`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              customId: `verify:captcha:submit:${guildId}`,
              label: "Enter code",
              style: ButtonStyle.Primary,
            },
          ],
        },
      ],
    });
    return;
  }
});

// --- Modal submit: verify:captcha:submit:<guildId> ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("verify:captcha:submit:")) return;

  const parts = customId.split(":");
  // verify:captcha:submit:<guildId>
  const guildId = parts[3];
  if (!guildId) return;

  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    await interaction.reply({ content: "This form is not valid for this server.", ephemeral: true });
    return;
  }

  const codeInput = interaction.fields.getTextInputValue("captchaCode");
  const userId = interaction.user.id;

  const state = await service.deps.getVerificationState(guildId, userId);
  if (!state || state.method !== "captcha" || state.passedAt) {
    await interaction.reply({ content: "No active captcha verification found.", ephemeral: true });
    return;
  }

  const attempts = state.attempts + 1;
  const maxAttempts = 3;

  if (VerificationService.verifyCaptcha(codeInput, state.captchaAnswer!)) {
    const member = guild.members.cache.get(userId);
    const unverifiedRole = guild.roles.cache.find((r: any) => r.name === "Unverified");

    if (member && unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
      try {
        await member.roles.remove(unverifiedRole, "Verified via captcha");
      } catch {
        // Role remove failed; continue
      }
    }

    await service.deps.setVerificationState({
      guildId,
      userId,
      method: "captcha",
      attempts,
      captchaAnswer: null,
      passedAt: new Date(),
    });

    await interaction.reply({ content: "Captcha verified! You are now verified.", ephemeral: true });
    return;
  }

  // Wrong code
  if (attempts >= maxAttempts) {
    const member = guild.members.cache.get(userId);
    try {
      if (member) await member.kick("Verification gate: too many captcha failures");
    } catch {
      // Kick failed; continue
    }
    await service.deps.clearVerificationState(guildId, userId);
    await interaction.reply({ content: "Too many failed attempts. You have been kicked.", ephemeral: true });
    return;
  }

  await service.deps.setVerificationState({
    guildId,
    userId,
    method: "captcha",
    attempts,
    captchaAnswer: state.captchaAnswer,
    passedAt: null,
  });

  await interaction.reply({
    content: `Incorrect code. Attempt ${attempts}/${maxAttempts}. Please try again.`,
    ephemeral: true,
  });
});
