// §11.9 AutoMod jobs — hourly phishing domain list refresh.
// This module exports job handlers that the worker or a cron scheduler can invoke.
import { AutomodRepository } from "./repository.js";

export interface PhishJobDeps {
  redisUrl: string;
  listUrls: string[]; // URLs of public phishing-domain lists
}

/** Download and merge public phishing-domain lists into Redis `phish:domains`. */
export async function refreshPhishDomains(deps: PhishJobDeps): Promise<{ domains: number; source: string[] }> {
  const repo = new AutomodRepository({ redisUrl: deps.redisUrl });
  const allDomains = new Set<string>();

  for (const url of deps.listUrls) {
    try {
      const resp = await globalThis.fetch(url);
      if (!resp.ok) continue;
      const text = await resp.text();
      for (const line of text.split(/[\r\n]+/)) {
        const domain = line.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (domain && !domain.startsWith("#") && !domain.startsWith("//")) {
          allDomains.add(domain);
        }
      }
    } catch {
      // Skip failed list sources; continue with remaining lists
    }
  }

  await repo.replacePhishDomains([...allDomains]);
  await repo.disconnect();
  return { domains: allDomains.size, source: deps.listUrls };
}
