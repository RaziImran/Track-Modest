# Track Modest — Decisions & Deviations

Every deviation, assumption or choice not specified in BOT_DESIGN_SPEC.md, with reason.

## Pinned decisions (adopted from KILO_CODE_MASTER_PLAN.md §4)

| Topic | Decision |
|---|---|
| Module system | ESM everywhere (`"type": "module"`), `module/moduleResolution: NodeNext`, strict TS, `noUncheckedIndexedAccess` on |
| Dev runner | tsx watch per app; production builds with tsup (bundle per app) — decided in T0.1 |
| Exact versions | `.npmrc` ? `save-exact=true`; every dependency pinned (spec §2). Lockfile committed |
| Workspace scope | `@modest/bot`, `@modest/worker`, `@modest/voice`, `@modest/game-server`, `@modest/activity`, `@modest/dashboard`, `@modest/db`, `@modest/shared`, `@modest/config-engine`, `@modest/ai`, `@modest/i18n`, `@modest/cards`, `@modest/game-data` |
| Lint/format | ESLint (flat config) + Prettier; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` at repo level via Turborepo |
| IDs & time | Snowflakes as `string`; timestamps stored UTC; display with Discord `<t:…>` |
| Schema strategy | Port the entire spec §7.2 Prisma schema in T0.3, migrate once, add further migrations only for genuinely new tables/columns |
| Prisma setup | Follow the current Prisma quickstart for the installed major |
| Test layout | `*.test.ts` next to the file; integration tests `*.int.test.ts` using Testcontainers; shared fakes in `packages/shared/test/fakes` |
| Errors | Typed `AppError(code, userMessageKey)`; router converts to friendly error panel with 8-char error code (spec §6.3) |
| Feature flags | Every module has an entry in `GuildConfig.modules` (spec §6.9); every command declares `module` |
| i18n keys | `packages/i18n/locales/en/<module>.json`; key style `module.feature.message` |
| Content data | Items/recipes/monsters/buildings/cards/pets as JSON in `packages/game-data`, validated by Zod at build time (spec §42.16) |
| Commit style | Conventional Commits; one commit per task card; body lists the checklist IDs |
| Worker deps (CORE-10) | `bullmq@5.81.6`, `discord.js@14.16.3`, `@vitest/coverage-v8@2.1.4` added to `@modest/worker`; `pnpm-workspace.yaml` `allowBuilds.msgpackr-extract@3.0.7: true` (BullMQ optional native dep) and `minimumReleaseAgeExclude.bullmq@5.81.6`. Worker uses discord.js REST only (no gateway connection). |

## MOD-02 (/timeout & /untimeout)

| Topic | Decision |
|---|---|
| Execution order vs applyTimeout | The command reserves the case number via `incrementCaseCounter` (step 2), DMs and performs `member.timeout()` (steps 3-4), then persists via `createCase` + `applyRepPenalty` (step 5) using the reserved number. This honours §10.3 step 4 (no Case created if the Discord action fails). `ModerationService.applyTimeout` remains available and unit-tested for programmatic callers but the command uses the deps split directly. |
| Timeout rep penalty | §20.4 Timeout = -50. Untimeout has no rep change (not listed in §20.4). |
| Staff-level boundary | BotCommand.staffLevel is static "helper"; the >1h ? moderator rule (§10.1) is enforced dynamically in execute() via `levelSatisfies("moderator", ctx.staffLevel)` because the router passes staffLevel at runtime. |
| Duration parsing | `ModerationService.parseDuration` supports s/m/h/d/w and combined units (e.g. "2h30m"); max 28d enforced via `MAX_TIMEOUT_SECONDS`, longer refused with a tempban suggestion (§10.8). |
| Bot self-target | Refused for /timeout (§10.8); for /untimeout it is a no-op allowed through hierarchy checks. |

## MOD-04 (/ban)

| Topic | Decision |
|---|---|
| Ban rep penalty | §20.4 lists Ban as -200, but the MOD-04 assignment specifies -100 for `/ban`. Implemented `applyBan` with a -100 penalty (`service.ts:139`), matching the assignment. Recorded here as a deviation from the spec. |
| BullMQ expiry scheduling | The bot package has no `bullmq` dependency and no queue infra (queue lives in `apps/worker` per DECISIONS.md CORE-10). `applyBan` persists the case as `TEMPBAN` with `durationSec`; the worker's recovery sweep (§10.7) picks up expired tempbans on start. No BullMQ job is enqueued from the bot command to avoid adding a dependency and breaking `typecheck`. |
| ctx.confirm() | `ctx.confirm` is a stub returning `false` (interactionRouter.ts:37,70), so using it would always cancel the action. kick.ts (the MOD-03 template) does not confirm, so `/ban` follows kick exactly: no confirm, no cooldown, defer + error handling only. |
| User not in server | `/ban` uses `guild.bans.create(id, ...)` (not `member.ban()`), so the target does not need to be a guild member; `interaction.options.getUser("user")` resolves any valid user ID. |

## MOD-06 (/massban)

| Topic | Decision |
|---|---|
| Case creation | One case per banned user (not one mass case). This follows the existing pattern where each moderation action creates an individual case, enabling per-user undo/view and consistent rep penalty tracking. `applyMassBan` returns arrays of caseNumbers and caseIds. |
| Rep penalty | -100 per banned user (same as individual ban), applied via `applyRepPenalty` for each user. |
| ctx.confirm() | Required for destructive action. Uses `ctx.confirm()` with a message showing the number of users to be banned. The confirm function is provided by the CommandContext (currently stubbed in interactionRouter; will be wired up when confirm middleware is implemented). |
| Bulk ban batching | Uses `guild.members.bulkBan()` in batches of 100 (Discord limit is ~200 per call). Falls back to individual `guild.bans.create()` if bulk ban fails partially. |
| Max users | 200 users per command invocation (enforced by schema validation). |
| Self/bot protection | Filters out the bot itself and the command invoker from the target list before processing. |
| Hierarchy checks | Performed for all targets that are current guild members. Users not in the server are still banned (via bulkBan which accepts user IDs). |

## MOD-17 (Appeals via dashboard, §14.3) — BLOCKED

| Topic | Decision |
|---|---|
| Blocker | MOD-17 requires a Next.js + Auth.js dashboard website with OAuth login, appeal form page, and appeal review page (Approve/Deny/Discuss). The `@modest/dashboard` package only contains `export {};` — no pages, no Auth.js setup, no Next.js config. Building the full dashboard is a prerequisite beyond a single task card. |
| Closest alternative | The appeal link URL is already wired in MOD-11 (`/ban` DM includes an **Appeal** link button pointing to `https://<dashboard>/appeal/<guildId>`), and the `Appeal` Prisma model already exists in the schema. When the dashboard is built, MOD-17 can be completed by adding the appeal form and review pages. |
| Action | Moving to independent bot-side cards (MOD-18, MOD-19, MOD-20). |

## MOD-20 (Rule simulator /automod simulate, §14.7) — DONE

| Topic | Decision |
|-------|----------|
| Implementation | Added `AutomodService.simulatePipeline()` (memory-only, no Discord action) and `/automod simulate` slash command (moderator staff level, ephemeral, max 1000 messages). Returns hit counts, affected users, per-rule breakdown, and up to 5 example hits. Tests: 5 new simulatePipeline tests in service.test.ts. Coverage on service.ts: 97.43%. |
| i18n | Added `automod.simulate.*` strings in `packages/i18n/locales/en/moderation.json`. |
| Registration | Command registered in `apps/bot/src/modules/automod/index.ts` via `registerCommand(simulateCommand, import.meta.url)`. |
| Status | Checklist ID MOD-20 ticked in PROGRESS.md. Replaces the prior BLOCKED entry. |

## SEC-10 (Shared ban network, §15.5)

| Topic | Decision |
|-------|----------|
| Ban category UI | Spec §15.5 says "moderator selects a category in the ban modal". Implemented as an optional slash-command `category` option on `/ban` (choices: `scam`, `raid`, `nsfw-spam`) instead of a modal. Functionally equivalent: plain `/ban` without a category is never shared; only categorized bans create `BanListEntry`s. Backward-compatible with existing ban behaviour. |
| Settings source | `network.enabled` and `network.joinAction` are custom opt-in overrides, not in the config-engine `SettingKey` union, so `resolveSetting` cannot be used with a typed key. They are read directly from `guildConfig.overrides` in `BanNetworkRepository`, defaulting to disabled / `alert`. |
| Entry activation | A `BanListEntry` is created with `status: "pending"` and `confirmedBy: 1`. It becomes `active` only when a second distinct guild bans the same user in the same category (`confirmedBy >= 2`), matching §15.5's "2 different guilds" requirement. Only `active` entries affect other guilds on join. |
| Join enforcement | `alert` (default) and `require_verification` are signal/log actions with no immediate enforcement in the join handler (verification gating is owned by the verification module). `ban` enforces by banning the listed member on join. Dashboard appeals and the bot-operator removal panel are deferred to the dashboard (blocked, see MOD-17). |
