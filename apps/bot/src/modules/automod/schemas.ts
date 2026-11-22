// §11 AutoMod — Zod validation schemas for rule inputs and command args.
import { z } from "zod";

export const AutomodActionSchema = z.enum([
  "delete",
  "delete_timeout",
  "warn",
  "timeout",
  "kick",
  "ban",
  "alert",
  "addRole",
]);

export type AutomodAction = z.infer<typeof AutomodActionSchema>;

export const AutomodLinkModeSchema = z.enum(["allow", "allowlist", "block"]);
export type AutomodLinkMode = z.infer<typeof AutomodLinkModeSchema>;

export const AutomodInviteModeSchema = z.enum(["allow", "block"]);
export type AutomodInviteMode = z.infer<typeof AutomodInviteModeSchema>;

export const AutomodBadWordsLevelSchema = z.enum(["off", "standard", "extended"]);
export type AutomodBadWordsLevel = z.infer<typeof AutomodBadWordsLevelSchema>;

export const AutomodTriggerSchema = z.enum(["keywords", "regex", "links", "attachments", "newAccount"]);
export type AutomodTrigger = z.infer<typeof AutomodTriggerSchema>;

// Trigger-specific config validation (stored in AutomodRule.trigger Json)
export const KeywordsTriggerConfigSchema = z.object({
  words: z.array(z.string().min(1)).min(1),
  matchMode: z.enum(["word", "contains"]).default("word"),
});
export type KeywordsTriggerConfig = z.infer<typeof KeywordsTriggerConfigSchema>;

export const RegexTriggerConfigSchema = z.object({
  pattern: z.string().min(1).max(200, "Regex pattern too long (max 200 chars)"),
});
export type RegexTriggerConfig = z.infer<typeof RegexTriggerConfigSchema>;

export const LinksTriggerConfigSchema = z.object({
  domains: z.array(z.string().min(1)).min(1),
});
export type LinksTriggerConfig = z.infer<typeof LinksTriggerConfigSchema>;

export const AttachmentsTriggerConfigSchema = z.object({
  blockedExtensions: z.array(z.string().min(1)).default([]),
  maxSizeBytes: z.number().int().positive().optional(),
  maxCount: z.number().int().positive().optional(),
});
export type AttachmentsTriggerConfig = z.infer<typeof AttachmentsTriggerConfigSchema>;

export const NewAccountTriggerConfigSchema = z.object({
  maxAccountAgeDays: z.number().int().positive(),
  blockLinks: z.boolean().default(true),
  blockAttachments: z.boolean().default(true),
});
export type NewAccountTriggerConfig = z.infer<typeof NewAccountTriggerConfigSchema>;

export const AutomodRuleTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("keywords"), config: KeywordsTriggerConfigSchema }),
  z.object({ type: z.literal("regex"), config: RegexTriggerConfigSchema }),
  z.object({ type: z.literal("links"), config: LinksTriggerConfigSchema }),
  z.object({ type: z.literal("attachments"), config: AttachmentsTriggerConfigSchema }),
  z.object({ type: z.literal("newAccount"), config: NewAccountTriggerConfigSchema }),
]);

export type AutomodRuleTrigger = z.infer<typeof AutomodRuleTriggerSchema>;

export const AutomodRuleActionSchema = z.object({
  type: AutomodActionSchema,
  // timeout seconds when type === "timeout"
  seconds: z.number().int().positive().optional(),
  // role id when type === "addRole"
  roleId: z.string().optional(),
});

export type AutomodRuleAction = z.infer<typeof AutomodRuleActionSchema>;

export const CreateAutomodRuleSchema = z.object({
  guildId: z.string().min(1),
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  shadow: z.boolean().default(false),
  trigger: AutomodRuleTriggerSchema,
  actions: z.array(AutomodRuleActionSchema).min(1).max(5),
  exemptRoles: z.array(z.string()).default([]),
  exemptChannels: z.array(z.string()).default([]),
  createdBy: z.string().min(1),
});

export type CreateAutomodRuleInput = z.infer<typeof CreateAutomodRuleSchema>;

export const UpdateAutomodRuleSchema = CreateAutomodRuleSchema.partial().omit({ guildId: true, createdBy: true });
export type UpdateAutomodRuleInput = z.infer<typeof UpdateAutomodRuleSchema>;

export function validateCreateAutomodRule(raw: unknown): CreateAutomodRuleInput | { error: string } {
  const parsed = CreateAutomodRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rule input" };
  }
  return parsed.data;
}

export function validateUpdateAutomodRule(raw: unknown): UpdateAutomodRuleInput | { error: string } {
  const parsed = UpdateAutomodRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rule update" };
  }
  return parsed.data;
}

// Bad-word normalization options
export const BadWordsLevelSchema = z.enum(["off", "standard", "extended"]);
export type BadWordsLevel = z.infer<typeof BadWordsLevelSchema>;
