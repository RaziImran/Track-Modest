import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  APIActionRowComponent,
} from "discord.js";

// Component V2 type constants (not in ComponentType enum in discord.js v14)
const V2_COMPONENT_TYPE = {
  ACTION_ROW: 1,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  SEPARATOR: 14,
  CONTAINER: 17,
} as const;

export interface ButtonOptions {
  customId: string;
  label: string;
  style?: ButtonStyle;
  emoji?: string;
  disabled?: boolean;
  url?: string;
}

function createButtonBuilder(options: ButtonOptions): ButtonBuilder {
  const builder = new ButtonBuilder()
    .setLabel(options.label)
    .setStyle(options.style ?? ButtonStyle.Primary);

  if (options.emoji) {
    builder.setEmoji(options.emoji);
  }
  if (options.disabled) {
    builder.setDisabled(true);
  }
  if (options.url) {
    builder.setURL(options.url).setStyle(ButtonStyle.Link);
  } else if (options.customId) {
    builder.setCustomId(options.customId);
  }

  return builder;
}

export function button(options: ButtonOptions): any {
  return createButtonBuilder(options).toJSON();
}

export function primaryButton(customId: string, label: string, emoji?: string, disabled = false): any {
  return button({ customId, label, style: ButtonStyle.Primary, emoji, disabled });
}

export function secondaryButton(customId: string, label: string, emoji?: string, disabled = false): any {
  return button({ customId, label, style: ButtonStyle.Secondary, emoji, disabled });
}

export function successButton(customId: string, label: string, emoji?: string, disabled = false): any {
  return button({ customId, label, style: ButtonStyle.Success, emoji, disabled });
}

export function dangerButton(customId: string, label: string, emoji?: string, disabled = false): any {
  return button({ customId, label, style: ButtonStyle.Danger, emoji, disabled });
}

export function linkButton(url: string, label: string, emoji?: string): any {
  return button({ customId: "", label, style: ButtonStyle.Link, emoji, url });
}

function restoreButtonBuilder(btn: any): ButtonBuilder {
  const builder = new ButtonBuilder()
    .setCustomId(btn.custom_id ?? btn.customId)
    .setLabel(btn.label)
    .setStyle(btn.style);
  if (btn.emoji) builder.setEmoji(btn.emoji);
  if (btn.disabled) builder.setDisabled(true);
  if (btn.url) builder.setURL(btn.url);
  return builder;
}

function restoreSelectMenuBuilder(select: any): StringSelectMenuBuilder {
  const builder = new StringSelectMenuBuilder()
    .setCustomId(select.custom_id ?? select.customId)
    .setPlaceholder(select.placeholder)
    .setMinValues(select.min_values ?? select.minValues ?? 1)
    .setMaxValues(select.max_values ?? select.maxValues ?? 1);
  if (select.disabled) builder.setDisabled(true);
  for (const opt of select.options ?? []) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(opt.label)
      .setValue(opt.value);
    if (opt.description) option.setDescription(opt.description);
    if (opt.emoji) option.setEmoji(opt.emoji);
    if (opt.default) option.setDefault(true);
    builder.addOptions(option);
  }
  return builder;
}

function restoreTextInputBuilder(input: any): TextInputBuilder {
  const builder = new TextInputBuilder()
    .setCustomId(input.custom_id ?? input.customId)
    .setLabel(input.label)
    .setStyle(input.style)
    .setRequired(input.required ?? true);
  if (input.placeholder) builder.setPlaceholder(input.placeholder);
  if (input.value) builder.setValue(input.value);
  if (input.min_length ?? input.minLength) builder.setMinLength(input.min_length ?? input.minLength ?? 0);
  if (input.max_length ?? input.maxLength) builder.setMaxLength(input.max_length ?? input.maxLength ?? 0);
  return builder;
}

export function buttonRow(...buttons: (ButtonBuilder | any)[]): any {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const btn of buttons) {
    if (btn instanceof ButtonBuilder) {
      row.addComponents(btn);
    } else {
      row.addComponents(restoreButtonBuilder(btn));
    }
  }
  return row.toJSON();
}

export function actionRow(...components: any[]): any {
  const row = new ActionRowBuilder<any>();
  for (const comp of components) {
    if (comp instanceof ButtonBuilder || comp instanceof StringSelectMenuBuilder || comp instanceof TextInputBuilder) {
      row.addComponents(comp);
    } else if (comp.type === ComponentType.Button) {
      row.addComponents(restoreButtonBuilder(comp));
    } else if (comp.type === ComponentType.StringSelect) {
      row.addComponents(restoreSelectMenuBuilder(comp));
    } else if (comp.type === ComponentType.TextInput) {
      row.addComponents(restoreTextInputBuilder(comp));
    }
  }
  return row.toJSON();
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

export interface SelectMenuOptions {
  customId: string;
  placeholder: string;
  options: SelectOption[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

function createSelectMenuBuilder(options: SelectMenuOptions): StringSelectMenuBuilder {
  const builder = new StringSelectMenuBuilder()
    .setCustomId(options.customId)
    .setPlaceholder(options.placeholder)
    .setMinValues(options.minValues ?? 1)
    .setMaxValues(options.maxValues ?? 1);

  if (options.disabled) {
    builder.setDisabled(true);
  }

  for (const opt of options.options) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(opt.label)
      .setValue(opt.value);
    if (opt.description) option.setDescription(opt.description);
    if (opt.emoji) option.setEmoji(opt.emoji);
    if (opt.default) option.setDefault(true);
    builder.addOptions(option);
  }

  return builder;
}

export function selectMenu(options: SelectMenuOptions): any {
  return createSelectMenuBuilder(options).toJSON();
}

export function selectRow(customId: string, placeholder: string, options: SelectOption[], disabled = false): any {
  return actionRow(createSelectMenuBuilder({ customId, placeholder, options, disabled }));
}

export interface TextInputOptions {
  customId: string;
  label: string;
  style?: TextInputStyle;
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

function createTextInputBuilder(options: TextInputOptions): TextInputBuilder {
  const builder = new TextInputBuilder()
    .setCustomId(options.customId)
    .setLabel(options.label)
    .setStyle(options.style ?? TextInputStyle.Short)
    .setRequired(options.required ?? true);

  if (options.placeholder) builder.setPlaceholder(options.placeholder);
  if (options.value) builder.setValue(options.value);
  if (options.minLength) builder.setMinLength(options.minLength);
  if (options.maxLength) builder.setMaxLength(options.maxLength);

  return builder;
}

export function textInput(options: TextInputOptions): any {
  return createTextInputBuilder(options).toJSON();
}

export function shortTextInput(customId: string, label: string, placeholder?: string, required = true): any {
  return textInput({ customId, label, style: TextInputStyle.Short, placeholder, required });
}

export function paragraphInput(customId: string, label: string, placeholder?: string, required = true): any {
  return textInput({ customId, label, style: TextInputStyle.Paragraph, placeholder, required });
}

export interface ModalOptions {
  customId: string;
  title: string;
  components: APIActionRowComponent<any>[];
}

export function modal(options: ModalOptions): any {
  const builder = new ModalBuilder()
    .setCustomId(options.customId)
    .setTitle(options.title);

  for (const row of options.components) {
    const actionRow = new ActionRowBuilder<TextInputBuilder>();
    for (const comp of row.components) {
      const inputBuilder = restoreTextInputBuilder(comp);
      actionRow.addComponents(inputBuilder);
    }
    builder.addComponents(actionRow);
  }

  return builder.toJSON();
}

export function createModal(customId: string, title: string, ...inputs: (TextInputBuilder | any)[]): any {
  const rows = inputs.map((input) => actionRow(input));
  return modal({ customId, title, components: rows });
}

export const V2_COMPONENT_TYPES = V2_COMPONENT_TYPE;

export const COMPONENT_LIMITS = {
  MAX_ACTION_ROWS: 5,
  MAX_BUTTONS_PER_ROW: 5,
  MAX_SELECT_OPTIONS: 25,
  MAX_SELECT_MENU_PLACEHOLDER_LENGTH: 150,
  MAX_BUTTON_LABEL_LENGTH: 80,
  MAX_MODAL_TITLE_LENGTH: 45,
  MAX_TEXT_INPUT_LABEL_LENGTH: 45,
  MAX_TEXT_INPUT_PLACEHOLDER_LENGTH: 100,
  MAX_TEXT_INPUT_VALUE_LENGTH: 4000,
  MAX_CONTAINER_COMPONENTS: 40,
} as const;

export function validateButton(btn: any): string | null {
  if (btn.label && btn.label.length > COMPONENT_LIMITS.MAX_BUTTON_LABEL_LENGTH) {
    return `Button label exceeds ${COMPONENT_LIMITS.MAX_BUTTON_LABEL_LENGTH} characters`;
  }
  const cid = btn.custom_id ?? btn.customId;
  if (cid && cid.length > 100) {
    return "Button customId exceeds 100 characters";
  }
  return null;
}

export function validateSelectMenu(select: any): string | null {
  if (select.placeholder && select.placeholder.length > COMPONENT_LIMITS.MAX_SELECT_MENU_PLACEHOLDER_LENGTH) {
    return `Select placeholder exceeds ${COMPONENT_LIMITS.MAX_SELECT_MENU_PLACEHOLDER_LENGTH} characters`;
  }
  if (select.options && select.options.length > COMPONENT_LIMITS.MAX_SELECT_OPTIONS) {
    return `Select menu exceeds ${COMPONENT_LIMITS.MAX_SELECT_OPTIONS} options`;
  }
  for (const option of select.options ?? []) {
    if (option.label.length > 100) {
      return "Select option label exceeds 100 characters";
    }
    if (option.value.length > 100) {
      return "Select option value exceeds 100 characters";
    }
    if (option.description && option.description.length > 100) {
      return "Select option description exceeds 100 characters";
    }
  }
  return null;
}

export function validateModal(modalComp: any): string | null {
  if (modalComp.title.length > COMPONENT_LIMITS.MAX_MODAL_TITLE_LENGTH) {
    return `Modal title exceeds ${COMPONENT_LIMITS.MAX_MODAL_TITLE_LENGTH} characters`;
  }
  for (const row of modalComp.components) {
    for (const component of row.components) {
      if (component.type === ComponentType.TextInput) {
        const input = component as any;
        if (input.label.length > COMPONENT_LIMITS.MAX_TEXT_INPUT_LABEL_LENGTH) {
          return `Text input label exceeds ${COMPONENT_LIMITS.MAX_TEXT_INPUT_LABEL_LENGTH} characters`;
        }
        if (input.placeholder && input.placeholder.length > COMPONENT_LIMITS.MAX_TEXT_INPUT_PLACEHOLDER_LENGTH) {
          return `Text input placeholder exceeds ${COMPONENT_LIMITS.MAX_TEXT_INPUT_PLACEHOLDER_LENGTH} characters`;
        }
        if (input.value && input.value.length > COMPONENT_LIMITS.MAX_TEXT_INPUT_VALUE_LENGTH) {
          return `Text input value exceeds ${COMPONENT_LIMITS.MAX_TEXT_INPUT_VALUE_LENGTH} characters`;
        }
      }
    }
  }
  return null;
}

export function componentsV2Flag(): number {
  return 32768;
}

export function customId(module: string, action: string, ...args: string[]): string {
  const parts = [module, action, ...args.map((a) => a.replace(/:/g, "_"))];
  const id = parts.join(":");
  if (id.length > 100) {
    throw new Error(`Custom ID exceeds 100 characters: ${id}`);
  }
  return id;
}

export function parseCustomId(customId: string): { module: string; action: string; args: string[] } | null {
  const parts = customId.split(":");
  if (parts.length < 2) return null;
  return {
    module: parts[0]!,
    action: parts[1]!,
    args: parts.slice(2),
  };
}

export function isOurCustomId(customId: string, module: string): boolean {
  return customId.startsWith(`${module}:`);
}

export function disableAllComponents(rows: any[]): any[] {
  return rows.map((row) => {
    const newRow = { ...row };
    newRow.components = row.components.map((comp: any) => ({
      ...comp,
      disabled: true,
    }));
    return newRow;
  });
}

export function enableAllComponents(rows: any[]): any[] {
  return rows.map((row) => {
    const newRow = { ...row };
    newRow.components = row.components.map((comp: any) => ({
      ...comp,
      disabled: false,
    }));
    return newRow;
  });
}

export function setButtonLoading(rows: any[], customId: string, loadingLabel = "⏳ Working…"): any[] {
  return rows.map((row) => {
    const newRow = { ...row };
    newRow.components = row.components.map((comp: any) => {
      if (comp.type === ComponentType.Button && (comp.custom_id ?? "") === customId) {
        return { ...comp, label: loadingLabel, disabled: true };
      }
      return comp;
    });
    return newRow;
  });
}
