# Track Modest โ€” Decisions & Deviations

Every deviation, assumption or choice not specified in BOT_DESIGN_SPEC.md, with reason.

## Pinned decisions (adopted from KILO_CODE_MASTER_PLAN.md ยง4)

| Topic | Decision |
|---|---|
| Module system | ESM everywhere (`"type": "module"`), `module/moduleResolution: NodeNext`, strict TS, `noUncheckedIndexedAccess` on |
| Dev runner | tsx watch per app; production builds with tsup (bundle per app) โ€” decided in T0.1 |
| Exact versions | `.npmrc` โ’ `save-exact=true`; every dependency pinned (spec ยง2). Lockfile committed |
| Workspace scope | `@modest/bot`, `@modest/worker`, `@modest/voice`, `@modest/game-server`, `@modest/activity`, `@modest/dashboard`, `@modest/db`, `@modest/shared`, `@modest/config-engine`, `@modest/ai`, `@modest/i18n`, `@modest/cards`, `@modest/game-data` |
| Lint/format | ESLint (flat config) + Prettier; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` at repo root via Turborepo |
| IDs & time | Snowflakes as `string`; timestamps stored UTC; display with Discord `<t:โ€ฆ>` |
| Schema strategy | Port the entire spec ยง7.2 Prisma schema in T0.3, migrate once, add further migrations only for genuinely new tables/columns |
| Prisma setup | Follow the current Prisma quickstart for the installed major |
| Test layout | `*.test.ts` next to the file; integration tests `*.int.test.ts` using Testcontainers; shared fakes in `packages/shared/test/fakes` |
| Errors | Typed `AppError(code, userMessageKey)`; router converts to friendly error panel with 8-char error code (spec ยง6.3) |
| Feature flags | Every module has an entry in `GuildConfig.modules` (spec ยง6.9); every command declares `module` |
| i18n keys | `packages/i18n/locales/en/<module>.json`; key style `module.feature.message` |
| Content data | Items/recipes/monsters/buildings/cards/pets as JSON in `packages/game-data`, validated by Zod at build time (spec ยง42.16) |
| Commit style | Conventional Commits; one commit per task card; body lists the checklist IDs |
| Worker deps (CORE-10) | `bullmq@5.81.6`, `discord.js@14.16.3`, `@vitest/coverage-v8@2.1.4` added to `@modest/worker`; `pnpm-workspace.yaml` `allowBuilds.msgpackr-extract@3.0.7: true` (BullMQ optional native dep) and `minimumReleaseAgeExclude.bullmq@5.81.6`. Worker uses discord.js REST only (no gateway connection). |


## MOD-02 (/timeout & /untimeout)

| Topic | Decision |
|---|---|
| Execution order vs applyTimeout | The command reserves the case number via `incrementCaseCounter` (step 2), DMs and performs `member.timeout()` (steps 3-4), then persists via `createCase` + `applyRepPenalty` (step 5) using the reserved number. This honours ง10.3 step 4 (no Case created if the Discord action fails). `ModerationService.applyTimeout` remains available and unit-tested for programmatic callers but the command uses the deps split directly. |
| Timeout rep penalty | ง20.4 Timeout = -50. Untimeout has no rep change (not listed in ง20.4). |
| Staff-level boundary | BotCommand.staffLevel is static "helper"; the >1h ? moderator rule (ง10.1) is enforced dynamically in execute() via `levelSatisfies("moderator", ctx.staffLevel)` because the router passes staffLevel at runtime. |
| Duration parsing | `ModerationService.parseDuration` supports s/m/h/d/w and combined units (e.g. "2h30m"); max 28d enforced via `MAX_TIMEOUT_SECONDS`, longer refused with a tempban suggestion (ง10.8). |
| Bot self-target | Refused for /timeout (ง10.8); for /untimeout it is a no-op allowed through hierarchy checks. |
