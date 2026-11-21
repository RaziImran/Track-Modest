# Track Modest — Decisions & Deviations

Every deviation, assumption or choice not specified in BOT_DESIGN_SPEC.md, with reason.

## Pinned decisions (adopted from KILO_CODE_MASTER_PLAN.md §4)

| Topic | Decision |
|---|---|
| Module system | ESM everywhere (`"type": "module"`), `module/moduleResolution: NodeNext`, strict TS, `noUncheckedIndexedAccess` on |
| Dev runner | tsx watch per app; production builds with tsup (bundle per app) — decided in T0.1 |
| Exact versions | `.npmrc` → `save-exact=true`; every dependency pinned (spec §2). Lockfile committed |
| Workspace scope | `@modest/bot`, `@modest/worker`, `@modest/voice`, `@modest/game-server`, `@modest/activity`, `@modest/dashboard`, `@modest/db`, `@modest/shared`, `@modest/config-engine`, `@modest/ai`, `@modest/i18n`, `@modest/cards`, `@modest/game-data` |
| Lint/format | ESLint (flat config) + Prettier; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` at repo root via Turborepo |
| IDs & time | Snowflakes as `string`; timestamps stored UTC; display with Discord `<t:…>` |
| Schema strategy | Port the entire spec §7.2 Prisma schema in T0.3, migrate once, add further migrations only for genuinely new tables/columns |
| Prisma setup | Follow the current Prisma quickstart for the installed major |
| Test layout | `*.test.ts` next to the file; integration tests `*.int.test.ts` using Testcontainers; shared fakes in `packages/shared/test/fakes` |
| Errors | Typed `AppError(code, userMessageKey)`; router converts to friendly error panel with 8-char error code (spec §6.3) |
| Feature flags | Every module has an entry in `GuildConfig.modules` (spec §6.9); every command declares `module` |
| i18n keys | `packages/i18n/locales/en/<module>.json`; key style `module.feature.message` |
| Content data | Items/recipes/monsters/buildings/cards/pets as JSON in `packages/game-data`, validated by Zod at build time (spec §42.16) |
| Commit style | Conventional Commits; one commit per task card; body lists the checklist IDs |
