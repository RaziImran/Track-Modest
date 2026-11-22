import { registerCommand } from "../../core/commandRegistry.js";
import { settingsCommand } from "./commands/settings.js";
import { client } from "../../client.js";
import { Events, EmbedBuilder, SelectMenuBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalBuilder } from "discord.js";
import {
  getGuildConfig,
  setOverride,
  removeOverride,
  toggleModule,
  recordConfigChange,
} from "./repository.js";
import { SettingsService } from "./service.js";
import { type SettingsCategory, CATEGORY_LABELS } from "./schemas.js";
import { COLORS } from "../../core/reply.js";

const service = new SettingsService({
  getGuildConfig,
});

registerCommand(settingsCommand, import.meta.url);

// ── Interaction handler for settings panel ──

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isSelectMenu() && !interaction.isModalSubmit()) return;
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("settings:")) return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Settings must be configured in a server.", ephemeral: true });
    return;
  }

  const parts = customId.split(":");
  const action = parts[1];

  // ── Category select menu ──
  if (action === "category" && interaction.isSelectMenu()) {
    const category = interaction.values[0] as SettingsCategory;
    await showCategoryView(interaction, guild, category);
    return;
  }

  // ── Back to categories ──
  if (action === "back" && interaction.isButton()) {
    await showCategorySelect(interaction);
    return;
  }

  // ── Change setting button ──
  if (action === "change" && interaction.isButton()) {
    const path = parts[2] ?? "";
    await showChangeModal(interaction, path);
    return;
  }

  // ── Reset setting button ──
  if (action === "reset" && interaction.isButton()) {
    const path = parts[2] ?? "";
    await handleReset(interaction, guild, path);
    return;
  }

  // ── Toggle module button ──
  if (action === "toggle" && interaction.isButton()) {
    const moduleKey = parts[2] ?? "";
    await handleToggleModule(interaction, guild, moduleKey);
    return;
  }

  // ── Modal submit for changing a setting ──
  if (action === "change" && interaction.isModalSubmit()) {
    const path = parts[2] ?? "";
    await handleChangeSubmit(interaction, guild, path);
    return;
  }
});

async function showCategorySelect(
  interaction: any,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("Server Settings")
    .setDescription("Choose a category below to view and change its settings.")
    .setColor(COLORS.info);

  const categories: SettingsCategory[] = [
    "General", "Protection", "AutoMod", "Logging", "Welcome", "Roles",
    "Reputation", "XP", "Nova", "Economy & Games", "Tickets", "Advanced",
  ];

  const options = categories.map((cat) => ({
    label: CATEGORY_LABELS[cat],
    value: cat,
  }));

  const select = new ActionRowBuilder<SelectMenuBuilder>()
    .addComponents(
      new SelectMenuBuilder()
        .setCustomId("settings:category")
        .setPlaceholder("Select a category...")
        .addOptions(options),
    );

  await interaction.update({ embeds: [embed], components: [select] });
}

async function showCategoryView(
  interaction: any,
  guild: any,
  category: SettingsCategory,
): Promise<void> {
  const view = await service.getCategoryView(guild.id, category);
  if (!view) {
    await interaction.reply({ content: "Category not found.", ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Settings — ${CATEGORY_LABELS[category]}`)
    .setDescription(view.description)
    .setColor(COLORS.info);

  // Setting rows
  for (const setting of view.settings) {
    const badge = setting.isCustom ? " • custom" : " • profile";
    const valueStr = formatSettingValue(setting.value);
    embed.addFields({
      name: `${setting.label}${badge}`,
      value: valueStr,
      inline: true,
    });
  }

  // Module toggles
  if (view.modules.length > 0) {
    const moduleLines = view.modules.map(
      (m) => `${m.enabled ? "✅" : "⬜"} ${m.label}`,
    );
    embed.addFields({
      name: "Modules",
      value: moduleLines.join("\n"),
      inline: false,
    });
  }

  // Buttons: change/reset for each setting, toggle for each module
  const rows: any[] = [];
  let currentRow: any[] = [];

  for (const setting of view.settings) {
    currentRow.push({
      type: 2,
      custom_id: `settings:change:${setting.path}`,
      label: "Change",
      style: 2,
      disabled: false,
    });
    currentRow.push({
      type: 2,
      custom_id: `settings:reset:${setting.path}`,
      label: "Reset",
      style: 4,
      disabled: !setting.isCustom,
    });
    if (currentRow.length >= 5) {
      rows.push({ type: 1, components: currentRow });
      currentRow = [];
    }
  }

  for (const mod of view.modules) {
    currentRow.push({
      type: 2,
      custom_id: `settings:toggle:${mod.key}`,
      label: mod.enabled ? "Disable" : "Enable",
      style: mod.enabled ? 4 : 2,
      disabled: false,
    });
    if (currentRow.length >= 5) {
      rows.push({ type: 1, components: currentRow });
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push({ type: 1, components: currentRow });
  }

  // Back button
  rows.push({
    type: 1,
    components: [
      {
        type: 2,
        custom_id: "settings:back",
        label: "Back to categories",
        style: 2,
        disabled: false,
      },
    ],
  });

  await interaction.update({ embeds: [embed], components: rows });
}

function formatSettingValue(value: unknown): string {
  if (value === undefined || value === null) return "unset";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

async function showChangeModal(
  interaction: any,
  path: string,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`settings:change:${path}`)
    .setTitle(`Change ${path}`);

  const input = new TextInputBuilder()
    .setCustomId(`settings:change:${path}:value`)
    .setLabel("New value")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter the new value")
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );

  await interaction.showModal(modal);
}

async function handleChangeSubmit(
  interaction: any,
  guild: any,
  path: string,
): Promise<void> {
  const valueRaw = interaction.fields.getTextInputValue(`settings:change:${path}:value`);
  const oldValue = await getOldValue(guild.id, path);

  try {
    await setOverride(guild.id, path, valueRaw);
    await recordConfigChange(guild.id, interaction.user.id, "settings", path, oldValue, valueRaw);

    await interaction.reply({
      content: `Setting \`${path}\` updated.`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: "Failed to update setting.",
      ephemeral: true,
    });
  }
}

async function getOldValue(guildId: string, path: string): Promise<unknown> {
  const config = await getGuildConfig(guildId);
  if (!config) return undefined;
  return config.overrides[path] ?? undefined;
}

async function handleReset(
  interaction: any,
  guild: any,
  path: string,
): Promise<void> {
  const oldValue = await getOldValue(guild.id, path);
  try {
    await removeOverride(guild.id, path);
    await recordConfigChange(guild.id, interaction.user.id, "settings", path, oldValue, undefined);

    await interaction.reply({
      content: `Setting \`${path}\` reset to profile value.`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: "Failed to reset setting.",
      ephemeral: true,
    });
  }
}

async function handleToggleModule(
  interaction: any,
  guild: any,
  moduleKey: string,
): Promise<void> {
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "Config not found.", ephemeral: true });
    return;
  }

  const current = !!config.modules[moduleKey];
  const newValue = !current;
  const oldValue = config.modules[moduleKey];

  try {
    await toggleModule(guild.id, moduleKey, newValue);
    await recordConfigChange(guild.id, interaction.user.id, "settings", `modules.${moduleKey}`, oldValue, newValue);

    await interaction.reply({
      content: `Module \`${moduleKey}\` ${newValue ? "enabled" : "disabled"}.`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: "Failed to toggle module.",
      ephemeral: true,
    });
  }
}

export { settingsCommand };
