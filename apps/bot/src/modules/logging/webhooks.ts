export const WEBHOOK_NAME = "Modest Logs";

export function buildWebhookPayload(channelId: string): { name: string; channelId: string } {
  return { name: WEBHOOK_NAME, channelId };
}

export function webhookKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}
