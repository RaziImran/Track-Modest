import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
} from "discord.js";

export type PanelColor =
  | "brand"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "gold"
  | "rep";

export const PANEL_COLORS: Record<PanelColor, number> = {
  brand: 0x7c5cff,
  success: 0x3ba55d,
  danger: 0xed4245,
  warning: 0xfaa61a,
  info: 0x5865f2,
  gold: 0xf5c542,
  rep: 0x2ecc71,
};

export interface PanelField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface PanelAction {
  label: string;
  customId: string;
  style?: ButtonStyle;
  disabled?: boolean;
  emoji?: string;
}

export interface PanelSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

export interface PanelSelect {
  customId: string;
  placeholder: string;
  options: PanelSelectOption[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface PanelConfig {
  color?: PanelColor;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fields?: PanelField[];
  actions?: PanelAction[];
  selects?: PanelSelect[];
  footer?: string;
  accentColor?: number;
}

export function buildPanel(
  config: PanelConfig,
  t?: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; rows: any[] } {
  const embed = new EmbedBuilder()
    .setColor(config.accentColor ?? PANEL_COLORS[config.color ?? "brand"])
    .setTitle(t ? t(config.title) : config.title)
    .setTimestamp();

  if (config.description) {
    embed.setDescription(t ? t(config.description) : config.description);
  }

  if (config.fields && config.fields.length > 0) {
    for (const field of config.fields) {
      embed.addFields({
        name: t ? t(field.name) : field.name,
        value: t ? t(field.value) : field.value,
        inline: field.inline,
      });
    }
  }

  if (config.footer) {
    embed.setFooter({ text: t ? t(config.footer) : config.footer });
  }

  const rows: any[] = [];

  if (config.actions && config.actions.length > 0) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (const action of config.actions) {
      const label = t ? t(action.label) : action.label;
      const button = new ButtonBuilder()
        .setCustomId(action.customId)
        .setLabel(label)
        .setStyle(action.style ?? ButtonStyle.Primary);
      if (action.emoji) {
        button.setEmoji(action.emoji);
      }
      if (action.disabled) {
        button.setDisabled(true);
      }
      actionRow.addComponents(button);
    }
    rows.push(actionRow.toJSON());
  }

  if (config.selects && config.selects.length > 0) {
    for (const select of config.selects) {
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>();
      const menu = new StringSelectMenuBuilder()
        .setCustomId(select.customId)
        .setPlaceholder(t ? t(select.placeholder) : select.placeholder)
        .setMinValues(select.minValues ?? 1)
        .setMaxValues(select.maxValues ?? 1);
      if (select.disabled) {
        menu.setDisabled(true);
      }
      for (const option of select.options) {
        const label = t ? t(option.label) : option.label;
        const description = option.description ? (t ? t(option.description) : option.description) : undefined;
        menu.addOptions({
          label,
          value: option.value,
          description,
          emoji: option.emoji,
          default: option.default,
        });
      }
      selectRow.addComponents(menu);
      rows.push(selectRow.toJSON());
    }
  }

  return { embed, rows };
}

export function buildErrorPanel(
  title: string,
  description: string,
  errorCode: string,
  retryAction?: PanelAction,
  t?: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; rows: any[] } {
  const fields: PanelField[] = [
    { name: t ? t("ui.error.details") : "Details", value: description },
    { name: t ? t("ui.error.code") : "Error Code", value: `\`${errorCode}\`` },
  ];

  const actions: PanelAction[] = [];
  if (retryAction) {
    actions.push({ ...retryAction, style: ButtonStyle.Primary });
  }
  actions.push({
    label: t ? t("ui.common.dismiss") : "Dismiss",
    customId: "core:dismiss",
    style: ButtonStyle.Secondary,
  });

  const { embed, rows } = buildPanel(
    {
      color: "danger",
      title,
      fields,
      actions,
      footer: t ? t("ui.error.contact_support") : "Contact support if this persists.",
    },
    t,
  );
  embed.setDescription(description);
  return { embed, rows };
}

export function buildLoadingPanel(
  title: string,
  message: string,
  t?: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; rows: any[] } {
  return buildPanel(
    {
      color: "info",
      title,
      description: message,
      footer: t ? t("ui.common.please_wait") : "Please wait...",
    },
    t,
  );
}

export function buildConfirmationPanel(
  title: string,
  description: string,
  confirmAction: PanelAction,
  cancelAction: PanelAction = { label: "Cancel", customId: "core:cancel", style: ButtonStyle.Secondary },
  t?: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; rows: any[] } {
  return buildPanel(
    {
      color: "warning",
      title,
      description,
      actions: [confirmAction, cancelAction],
    },
    t,
  );
}

export function buildPaginationSelect(
  customId: string,
  currentPage: number,
  totalPages: number,
  placeholder: string,
  t?: (key: string, params?: Record<string, unknown>) => string,
): PanelSelect {
  const options: PanelSelectOption[] = [];
  for (let i = 1; i <= totalPages; i++) {
    options.push({
      label: `${i}`,
      value: `${i}`,
      default: i === currentPage,
    });
  }
  return {
    customId,
    placeholder: t ? t(placeholder) : placeholder,
    options,
  };
}

export function buildNavigationRow(
  backCustomId: string,
  homeCustomId: string = "core:hub",
  t?: (key: string, params?: Record<string, unknown>) => string,
): any {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(backCustomId)
      .setLabel(t ? t("ui.navigation.back") : "Back")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅"),
    new ButtonBuilder()
      .setCustomId(homeCustomId)
      .setLabel(t ? t("ui.navigation.home") : "Home")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏠"),
  );
  return row.toJSON();
}

export function buildExpiredPanel(
  originalTitle: string,
  reopenAction: PanelAction,
  t?: (key: string, params?: Record<string, unknown>) => string,
): { embed: EmbedBuilder; rows: any[] } {
  return buildPanel(
    {
      color: "warning",
      title: t ? t("ui.panel.expired_title") : "Panel Expired",
      description: t
        ? t("ui.panel.expired_description", { title: originalTitle })
        : `The panel "${originalTitle}" has expired after 15 minutes of inactivity.`,
      actions: [reopenAction],
    },
    t,
  );
}
