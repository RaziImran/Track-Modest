# Track Modest â€” Master Feature Checklist (PROGRESS.md)

Copy of spec Â§45. Tick each ID when done, with date & commit hash.

### Core platform (CORE)
- [x] CORE-01 Monorepo, TypeScript strict, lint, CI (4, 35) â€” 74bfff1
- [x] CORE-02 Env validation, logging, Sentry (5.4, 6.11, 36.4) â€” 4cdd5f2
- [x] CORE-03 Command registry, interaction router, middleware, error codes (6.2â€“6.3) â€” 3638e07
- [x] CORE-04 Staff levels & hierarchy checks (6.4) â€” 49daee1
- [x] CORE-05 Component ID encoding & ownership checks (6.5) — 2b0bba0
- [x] CORE-06 Standard replies, confirm pattern, cooldowns (6.6â€“6.8) — 79b202a
- [x] CORE-07 Module enable/disable (6.9) — eb38632
- [x] CORE-08 Database schema & migrations (7) â€” 5c59423
- [x] CORE-09 Redis keys & caching (7.3) â€” 5c59423
- [x] CORE-10 Worker app with BullMQ & recovery sweeps (3, 10.7) — 4e9d91d
- [x] CORE-11 UI helpers: panels, progress bars, numbers, timestamps, Components V2 (39) — e8f0c59
- [x] CORE-12 Hub `/menu` with tabs and red-dot indicators (39.5) — 34a1fa4
- [x] CORE-13 i18n with localized command descriptions (31) — f1c2e48
- [ ] CORE-14 Health checks, graceful shutdown, metrics (36.3â€“36.4)

### Configuration (CFG)
- [x] CFG-01 Size tiers auto-detect + override (8.2) â€” db88825
- [x] CFG-02 Strictness levels (8.2) â€” db88825
- [x] CFG-03 Resolver with full base table + size scaling + overrides + channel overrides + trust shift (8.3â€“8.6) â€” db88825
- [x] CFG-04 Config history & undo (8.7) — 2832b76
- [x] CFG-05 Adaptive size suggestions (8.8) — 0837e22
- [ ] CFG-06 Strictness recommendations (8.9)
- [ ] CFG-07 Temporary boost (8.10)
- [ ] CFG-08 Setup wizard with presets & preview (9.1â€“9.4)
- [ ] CFG-09 `/settings` panel with categories, custom badges, reset (9.5)

### Moderation (MOD)
- [x] MOD-01 `/warn` with points & reason templates (10.1â€“10.2) — 37180e7
- [x] MOD-02 `/timeout` & `/untimeout` with duration parsing (10.1) — c60919f
- [x] MOD-03 `/kick` (10.1) — feeb154
- [x] MOD-04 `/ban` incl. by ID, message deletion, tempban (10.1, 10.7) — 0a8dfc3
- [x] MOD-05 `/softban`, `/unban` with autocomplete (10.1) — f53ecea
- [ ] MOD-06 `/massban` with confirmation (10.1)
- [ ] MOD-07 `/purge` (any/user/bots/links/attachments/contains/regex), 14-day handling (10.1)
- [ ] MOD-08 `/lock`, `/unlock`, `/lockdown`, `/slowmode`, `/nick` (10.1)
- [ ] MOD-09 Moderate user & Moderate message context menus with quick panels (10.1)
- [x] MOD-10 Case system: numbering, view, edit, delete, history (10.1, 10.3) — 44c5832
- [ ] MOD-11 DM before removal with appeal link (10.3)
- [ ] MOD-12 Undo for all action types (10.4)
- [ ] MOD-13 Warning points with expiry & escalation ladder (10.5â€“10.6)
- [ ] MOD-14 `/modstats` (10.1, 14.4)
- [ ] MOD-15 Mod notes (14.1)
- [ ] MOD-16 Reports with queue, claim, escalation, reporter feedback (14.2)
- [ ] MOD-17 Appeals via dashboard (14.3)
- [ ] MOD-18 Staff activity in weekly report (14.5)
- [ ] MOD-19 Permission Doctor with one-click fixes (14.6)
- [ ] MOD-20 Rule simulator (14.7)

### AutoMod (AM)
- [ ] AM-01 Exemptions (11.2)
- [ ] AM-02 Phishing/scam link detection + hourly list refresh + report-domain (11.2, 11.9)
- [ ] AM-03 Invite filtering (own-server invites allowed) (11.2)
- [ ] AM-04 Link policy allow/allowlist/block (11.2)
- [ ] AM-05 Mention spam (11.2)
- [ ] AM-06 Message rate spam (11.2)
- [ ] AM-07 Duplicate & cross-channel spam (11.2)
- [ ] AM-08 Bad-word filter with normalization, leetspeak, Scunthorpe allowlist, per-language lists (11.3)
- [ ] AM-09 Caps/emoji/newlines/zalgo (11.2)
- [ ] AM-10 Custom rules with re2 regex & shadow flag (11.5)
- [ ] AM-11 Actions, public notice, DM explanation, log with Undo/False positive, repeat escalation (11.4)
- [ ] AM-12 AI context review â†’ review queue (11.6)
- [ ] AM-13 Media scan â†’ review queue (11.7)
- [ ] AM-14 Native Discord AutoMod sync (11.8)
- [ ] AM-15 Dangerous file warnings (23.4)

### Protection (SEC)
- [ ] SEC-01 Join-spike detection with baseline (12.1)
- [ ] SEC-02 Suspicion scoring & raid actions with alert buttons (12.1)
- [ ] SEC-03 Verification: button, captcha, quiz, account-age, kick-after (12.2)
- [ ] SEC-04 Anti-nuke via audit log with trusted users & bot-add protection (12.3)
- [ ] SEC-05 Compromised account detection (20.6)
- [ ] SEC-06 Risk score (15.1)
- [ ] SEC-07 Mod Review Queue with claim (15.2)
- [ ] SEC-08 Raid prediction (15.3)
- [ ] SEC-09 Shadow mode for rules & profiles (15.4)
- [ ] SEC-10 Shared ban network (2-guild confirmation, appeals) (15.5)

### Logging (LOG)
- [x] LOG-01 Message edit/delete/bulk delete (13.1) — 9cab6d8
- [x] LOG-02 Member join/leave/nick/avatar with invite tracking (13.1â€“13.2) — 70f067e
- [x] LOG-03 Roles, channels, voice, invites, server, emoji logs (13.1) — 06b91cc
- [x] LOG-04 Per-category channels, ignore lists, size-based verbosity, batching via webhooks (13.1â€“13.2) — 42283e6
- [x] LOG-05 Ghost ping detection (13.2) — a3f3317

### Member support (SUP)
- [ ] SUP-01 Tickets: panel, categories, questions, claim, transcripts, ratings, auto-close (18.1)
- [ ] SUP-02 Modmail with multi-server picker, anonymous replies, block (18.2)
- [ ] SUP-03 Custom commands & auto-responders (18.3)
- [ ] SUP-04 Embed builder (18.4)
- [ ] SUP-05 Scheduled & recurring messages (18.5)
- [ ] SUP-06 Sticky messages (18.6)
- [ ] SUP-07 Help channels with âœ… Solved flow (20.2)
- [ ] SUP-08 New member onboarding tour (39.7)
- [ ] SUP-09 `/why` explanations & Nova server knowledge answers (24.3, 22.4)

### Community (COM)
- [ ] COM-01 Welcome/goodbye with image cards (16.1)
- [ ] COM-02 Auto-roles (16.2)
- [ ] COM-03 Role menus (buttons/select/reactions, modes, requirements) (16.3)
- [ ] COM-04 XP & levels, voice XP, multipliers, level roles, `/rank`, leaderboards (16.4)
- [ ] COM-05 Starboard (17.1)
- [ ] COM-06 Birthdays (17.2)
- [ ] COM-07 Polls (17.3)
- [ ] COM-08 Giveaways (17.4)
- [ ] COM-09 Suggestions (17.5)
- [ ] COM-10 Temp voice channels (18.7)
- [ ] COM-11 Social feeds (19.1)
- [ ] COM-12 Outgoing webhooks (19.2)
- [ ] COM-13 Backups & restore (19.3)
- [ ] COM-14 Analytics & weekly report (19.4â€“19.5)
- [ ] COM-15 Friends, rivals, gifting (40.5)

### Reputation (REP)
- [ ] REP-01 Earning sources with caps (20.2)
- [ ] REP-02 Multipliers & anti-farming (20.3)
- [ ] REP-03 Penalties & undo restore (20.4)
- [ ] REP-04 Ranks, rank roles, perks (20.5)
- [ ] REP-05 Trust shift into config resolver (20.6)
- [ ] REP-06 `/rep` commands, transparency, hidden negatives (20.7â€“20.8)

### AI & Nova (AI)
- [ ] AI-01 Shared AI layer: consent, budgets, circuit breaker, output filter, usage records (21)
- [ ] AI-02 Nova chat triggers, personas, context, server knowledge (22.1â€“22.4)
- [ ] AI-03 Memory with sensitive-data exclusion & user controls (22.5)
- [ ] AI-04 Read-only tools (22.6)
- [ ] AI-05 Proactive behaviour (22.7)
- [ ] AI-06 Bond levels, streaks, daily quests (22.8)
- [ ] AI-07 File & attachment understanding (23)
- [ ] AI-08 Config assistant with diff preview (24.1)
- [ ] AI-09 Mod copilot (24.2)
- [ ] AI-10 Nova character bible & persona files (41.2)
- [ ] AI-11 Nova portraits & moods (41.3)
- [ ] AI-12 Nova Hub (41.4)
- [ ] AI-13 Rich replies: regenerate, continue, speak, feedback, suggestion chips (41.5)
- [ ] AI-14 Nova fun commands, gifts, diary, milestones, outfits (41.6)
- [ ] AI-15 Wellbeing & safety guardrails (41.8)
- [ ] AI-16 Prompt-injection test suite (22.11)

### Voice (VOX)
- [ ] VOX-01 Separate voice service with Redis commands (29.3)
- [ ] VOX-02 Consent model & indicators (29.2)
- [ ] VOX-03 Audio pipeline & Gemini Live (29.4â€“29.5)
- [ ] VOX-04 Push-to-talk & conversation modes, floor control, barge-in (29.5)
- [ ] VOX-05 Voice personas & transcripts (29.1)
- [ ] VOX-06 Fallback STTâ†’LLMâ†’TTS pipeline (29.6)
- [ ] VOX-07 Live translation (29.7)
- [ ] VOX-08 Call summaries (29.7)
- [ ] VOX-09 Voice moderation in monitored channels (29.7)
- [ ] VOX-10 Voice games & game narration (29.7, 28.10)
- [ ] VOX-11 Voice mod commands with confirmation (29.7)

### Economy & engagement (ECO)
- [ ] ECO-01 Wallets & ledger with row locking (25.3)
- [ ] ECO-02 Daily/weekly/work/chat earnings (25.4)
- [ ] ECO-03 Server shop, `/pay`, inventory (25.5â€“25.6)
- [ ] ECO-04 Anti-abuse & inflation controls (25.7)
- [ ] ECO-05 Season Pass (40.2)
- [ ] ECO-06 Collections (40.3)
- [ ] ECO-07 Streaks with freezes & repair (40.4)
- [ ] ECO-08 Opt-in reminders with quiet hours (40.6)
- [ ] ECO-09 Guardrails: odds shown, break reminders, leaderboard opt-out (40.7)
- [ ] ECO-10 Profile card, badges (150+), achievements (30)

### Games (GAME)
- [ ] GAME-01 Shopkeeper idle tycoon incl. prestige, orders, server goal, themes (26)
- [ ] GAME-02 Trivia (27.1)
- [ ] GAME-03 Hangman, word chain, anagram (27.2)
- [ ] GAME-04 Tic-tac-toe & connect four incl. vs Nova (27.3)
- [ ] GAME-05 Rock-paper-scissors (27.4)
- [ ] GAME-06 Fishing, mining, foraging, crafting (27.5)
- [ ] GAME-07 AI story adventure (27.6)
- [ ] GAME-08 Trading (27.7)
- [ ] GAME-09 Pet Pals (43 G1)
- [ ] GAME-10 Farmstead (43 G2)
- [ ] GAME-11 Dungeon Delve (43 G3)
- [ ] GAME-12 Card Clash (43 G4)
- [ ] GAME-13 Moonlit Village (43 G5)
- [ ] GAME-14 Chess & checkers (43 G6)
- [ ] GAME-15 Five daily word game (43 G7)
- [ ] GAME-16 Doodle Dash Activity (43 G8)
- [ ] GAME-17 Sky Racers Activity (43 G9)
- [ ] GAME-18 Last Standing (43 G10)
- [ ] GAME-19 Heist Crew (43 G11)
- [ ] GAME-20 Server Pet (43 G12)
- [ ] GAME-21 Counting (43 G13)
- [ ] GAME-22 Typing Race (43 G14)
- [ ] GAME-23 Melody Guess (43 G15)
- [ ] GAME-24 Nova's Arcade (43 G16)

### Hollowdeep (HD)
- [ ] HD-01 Activity auth & launch flow (28.2)
- [ ] HD-02 Server-authoritative Colyseus rooms, prediction, interpolation (28.3)
- [ ] HD-03 World generation, sizes, biomes, underground variants, structures (28.4, 42.3)
- [ ] HD-04 Chunk streaming & persistence (28.3â€“28.4)
- [ ] HD-05 Player systems: health/mana upgrades, movement, hooks, mounts, wings, inventory, equipment, buffs, death modes, difficulty modes, character creation (42.4)
- [ ] HD-06 Combat classes & Tempering prefixes (42.5)
- [ ] HD-07 Building: blocks, walls, furniture, slopes, paint, lighting items (42.6)
- [ ] HD-08 Wiring & mechanisms (42.6, 42.11)
- [ ] HD-09 Housing, NPCs, happiness, shops (42.9)
- [ ] HD-10 Crafting stations, recipe browser, accessory combining (42.7)
- [ ] HD-11 Mining, trees, herbs, farming, fishing, critters, bestiary (42.8)
- [ ] HD-12 Enemies: AI archetypes, spawn rules, banners (42.10)
- [ ] HD-13 Bosses 1â€“4, Emberheart, Act III bosses, Hollow King (42.2)
- [ ] HD-14 World awakening & spreading biomes (42.3, 42.11)
- [ ] HD-15 Liquids, falling blocks, lighting, weather, moon phases (42.3, 42.11)
- [ ] HD-16 Events: Blood Tide, Raider Warband, Ashfall, seasonal nights, Starfall Siege (42.3)
- [ ] HD-17 Multiplayer: teams, PvP toggle, map & minimap, claims, world moderation, chat bridge (42.12)
- [ ] HD-18 Client UI & controls: keyboard, gamepad, touch (42.13)
- [ ] HD-19 Audio (42.14)
- [ ] HD-20 Discord integration: panel, announcements, weekly boss, bank, badges (42.15, 28.10)
- [ ] HD-21 Chat mode (28.11)
- [ ] HD-22 Content pipeline with Zod validation & 100-seed soft-lock test (42.16, 42.18)

### Dashboard & platform (PLAT)
- [ ] PLAT-01 Dashboard auth & permission checks (32.1)
- [ ] PLAT-02 All dashboard pages (32.2)
- [ ] PLAT-03 Security controls (33)
- [ ] PLAT-04 Privacy policy, terms, retention jobs, `/forget-me`, `/my-data` (34)
- [ ] PLAT-05 Deployment, backups, monitoring, alerts (36)
- [ ] PLAT-06 Sharding readiness (36.5)
- [ ] PLAT-07 Premium tier (37)
- [ ] PLAT-08 Accessibility & reduced motion (39.9)

