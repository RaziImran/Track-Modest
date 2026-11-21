# Track Modest — Kilo Code Master Build Plan

> **Companion to:** `BOT_DESIGN_SPEC.md` (the *what*). This file is the *how and in what order*.
> **Audience:** Kilo Code (an AI coding agent in VS Code) and the human supervising it.
> **Goal:** Build the whole project **as fast as possible without rework** by (a) feeding the agent only the slice of the spec it needs, (b) splitting work into small independent tasks with hard acceptance gates, and (c) running independent tasks in parallel.
> **Spec line numbers** below match the spec as uploaded on 2026-11-21 (±2 lines). If the spec changes, regenerate the index with the command in §3.

---

## 0. TL;DR — start here

**Human, do this once (≈ 30–45 min):**
1. Create a repo folder `track-modest/`. Put the spec at `docs/BOT_DESIGN_SPEC.md` and this file at `docs/KILO_MASTER_PLAN.md`.
2. Finish the **human prerequisites** (§1): Discord app + token + intents, Gemini key, Docker, Node, pnpm, Git.
3. Create `AGENTS.md` from §2.3 (copy-paste). Create empty `PROGRESS.md`, `DECISIONS.md`, `CHANGELOG.md`, `COMMANDS.md`.
4. Open the folder in VS Code with Kilo Code. Select **Orchestrator** mode.
5. Paste the **Kickoff Prompt** (§12.1). From then on, only paste the **Resume Prompt** (§12.2) when a task finishes or context resets.

**Agent, the eight speed rules:**

| # | Rule | Why it saves time |
|---|---|---|
| S1 | **Never load the whole spec.** Read only the line ranges listed in the task card (`sed -n 'A,Bp' docs/BOT_DESIGN_SPEC.md`). | The spec is ~4,065 lines. Loading it all wastes context and degrades accuracy. |
| S2 | **One task card = one Kilo task = one commit.** Orchestrator delegates each card to a fresh sub-task. | Fresh context each time; no drift; easy to resume. |
| S3 | **Foundations before features.** Phase 0 + the shared helpers (UI, replies, module generator) make every later feature 3–5× faster. | Every feature reuses them. |
| S4 | **Pure logic first, Discord UI last.** Write `service.ts` + tests, then wire commands. | Logic bugs are cheap to find without Discord. |
| S5 | **Generate, don't hand-write.** Use the module generator (T0.6), Zod-validated JSON content, and seed scripts. | Removes repetitive boilerplate across ~60 modules. |
| S6 | **Gate every task with `pnpm lint && pnpm typecheck && pnpm test`.** Never move on while red. | Red builds compound into days of debugging. |
| S7 | **Parallelise independent lanes** (§6 dependency map). | Roughly halves wall-clock time in Phases 1, 2, 4 and 7. |
| S8 | **`PROGRESS.md` is the memory.** Tick IDs with commit hashes; the Resume Prompt rebuilds context from it. | Survives context resets and model switches. |

---

## 1. Human prerequisites (blockers the agent cannot do for you)

Do these **before** starting. Items marked ⛔ block the named phase.

| # | Task | Where / how | Blocks |
|---|---|---|---|
| H1 | Install **Node.js Active LTS**, run `corepack enable && corepack prepare pnpm@latest --activate` | https://nodejs.org · https://pnpm.io | ⛔ Phase 0 |
| H2 | Install **Docker Desktop** | https://www.docker.com/products/docker-desktop | ⛔ Phase 0 |
| H3 | Install **Git**, create a GitHub repo (for CI) | https://git-scm.com | ⛔ Phase 0 CI |
| H4 | Install **FFmpeg** (`ffmpeg -version` must work) | https://ffmpeg.org | Phase 5 |
| H5 | Create the **Discord application** (Dev Portal) → **Bot** tab: Reset Token (copy once), enable **Server Members Intent** + **Message Content Intent**, turn **Public Bot** off | https://discord.com/developers/applications · spec §5.2 (L457–470) | ⛔ Phase 0 |
| H6 | Copy **Client ID** and **Client Secret**; add redirect `http://localhost:3000/api/auth/callback/discord` | Dev Portal → OAuth2 | Dashboard |
| H7 | Generate the bot **invite URL** (scopes `bot`, `applications.commands`; permissions list in spec §5.2 — **never Administrator**) and add the bot to a **private test server** | Dev Portal → Installation / OAuth2 URL Generator | ⛔ Phase 0 |
| H8 | Create **two** test servers + at least one alt account (for hierarchy, raid and trade tests) | Discord | Phase 1+ |
| H9 | Get a **Gemini API key** (AI Studio). Note free tier may train on prompts — fine for dev only | https://aistudio.google.com · spec §5.3 | ⛔ Phase 3 |
| H10 | Look up **current Gemini model IDs** (chat, fast, vision, Live native-audio) and put them in `.env` — never hard-code | https://ai.google.dev/gemini-api/docs | Phase 3, 5 |
| H11 | (Optional) Sentry project → `SENTRY_DSN` | https://sentry.io | — |
| H12 | Upload **custom app emojis** (🪙 💠 ✨ 💜 🔥, rank icons) in the Dev Portal once the UI helper exists (T0.5); Unicode fallbacks work meanwhile | Dev Portal → Emojis | Polish |
| H13 | Activities: enable **Activities** for the app and add a **URL mapping** to a public HTTPS tunnel for local dev (e.g. cloudflared/ngrok) | Spec §28.2 (L2696–2707) · https://discord.com/developers/docs/activities/overview | ⛔ Phase 6 |
| H14 | Art/audio: pick CC0 prototype packs now (Kenney); commission/create original final art later | Spec §44.3 (L3748–3762) | Phase 6, polish |
| H15 | Staging + production: second Discord app ("Modest Beta"), VPS (4 vCPU / 8 GB), domain, off-site backup bucket | Spec §36 (L3103–3142) | Release |

**Secrets rule:** `.env` is git-ignored. The agent must never print, commit, or paste token values. If Kilo supports an ignore file (e.g. `.kilocodeignore`), list `.env*` in it.

---

## 2. Kilo Code setup

> Kilo Code's menu names and file conventions evolve. Verify against https://kilo.ai/docs before relying on exact names; the *practices* below are what matter.

### 2.1 Repository bootstrap files

```
track-modest/
├─ AGENTS.md                      # rules the agent reads every task (§2.3)
├─ PROGRESS.md                    # spec §45 checklist, ticked with commit hashes
├─ DECISIONS.md                   # every deviation/assumption + reason + pinned versions
├─ CHANGELOG.md
├─ COMMANDS.md                    # registry of every slash command (see §10.1)
├─ docs/
│  ├─ BOT_DESIGN_SPEC.md
│  └─ KILO_MASTER_PLAN.md
└─ (the monorepo from spec §4)
```

Seed `PROGRESS.md` straight from the spec (no retyping):

```bash
awk '/^## 45\./,/^## Appendix A/' docs/BOT_DESIGN_SPEC.md | grep -E '^(###|- \[ \])' > PROGRESS.md
```

### 2.2 Modes and model strategy

| Kilo mode | Use it for | Model tier |
|---|---|---|
| **Orchestrator** | Reads §12.1, picks next task card, delegates, verifies gates, updates `PROGRESS.md`. Does **not** write feature code. | Strongest available |
| **Architect** | New Prisma models, tricky designs (config resolver, ledger, worldgen, voice pipeline, Colyseus state schema) — produces a short plan in `DECISIONS.md`, then hands to Code | Strongest available |
| **Code** | Implementation of a single task card | Strong for logic-heavy cards (spec §8 config, §25 ledger, §28/§42 game server, §29 voice); fast/cheap for boilerplate (i18n, content JSON, dashboard forms, tests) |
| **Debug** | Any failing gate that is not fixed in 2 attempts | Strongest available |
| **Ask** | Quick questions about the spec or libraries | Fast |

### 2.3 `AGENTS.md` — paste this verbatim

```markdown
# Track Modest — Agent Rules (read every task)

## Source of truth
- Spec: docs/BOT_DESIGN_SPEC.md. Plan: docs/KILO_MASTER_PLAN.md. Checklist: PROGRESS.md.
- Read ONLY the spec line ranges in the current task card. Use: sed -n 'A,Bp' docs/BOT_DESIGN_SPEC.md
- If the spec is ambiguous: (1) Appendix B defaults, (2) safest for users, (3) simplest that meets "Done when"; record in DECISIONS.md.

## Stack (do not swap without a DECISIONS.md entry)
TypeScript strict · Node Active LTS · pnpm + Turborepo · discord.js v14 · PostgreSQL 16 + Prisma · Redis 7 + BullMQ ·
@google/genai · Zod · pino · Sentry · i18next · Vitest (+Testcontainers) · Next.js + Auth.js + Tailwind ·
Phaser 3 + Colyseus + @discord/embedded-app-sdk · @napi-rs/canvas · Docker Compose.
Pin EXACT versions (no ^ or ~). Workspace scope: @modest/*.

## Architecture rules
- Each feature = apps/bot/src/modules/<name>/{commands,components,events,service.ts,repository.ts,schemas.ts,jobs.ts,index.ts}.
- service.ts has NO discord.js imports (pure, unit-tested). UI lives in commands/ and components/.
- All user-facing text via i18n keys (en). All config via Zod schemas + config-engine resolver.
- IDs are strings (snowflakes). Never JS number.
- All panels use packages/shared/src/ui helpers + Components V2 (spec §39). Logs use classic embeds.
- Respond/defer within 3 s. Never ping (allowedMentions parse: []).
- Component customId = <module>:<action>:<args>; NEVER trust args; re-check permission + ownership.

## Hard rules (from spec §1.2, B.3)
1. AI never bans/kicks/times out/changes rep/coins/roles/config. AI suggests; code or humans act.
2. Never store audio. Never log message content/prompts at info level.
3. Never request Administrator permission.
4. Never hard-code Gemini model names (env: AI_MODEL_CHAT/FAST/VISION/LIVE).
5. Original content only: no names/art/sounds/items copied from commercial games.
6. No real-money gambling, paid loot boxes, or buying power.
7. Safety features are never paywalled.
8. Destructive actions need ctx.confirm(); every action is undoable where spec says so.
9. Do not stub or skip a checklist ID. If impossible, write the reason + closest alternative in DECISIONS.md and implement the alternative.

## Definition of done for a task
- Tests written and passing for every service.ts; coverage ≥ 80% on service.ts files.
- `pnpm lint && pnpm typecheck && pnpm test` all green.
- i18n strings added; settings added to config schema + /settings category.
- Every "Done when" bullet of the section checked.
- PROGRESS.md IDs ticked with commit hash; DECISIONS.md updated; one conventional commit per task.

## Behaviour
- Prefer small commits: `feat(mod): ...`, `fix(automod): ...`, `test(rep): ...`.
- Do not refactor unrelated code. Do not add dependencies without need; record each in DECISIONS.md.
- When docs may have changed (discord.js, Prisma, Gemini, Discord limits), check current docs before coding.
- If blocked >2 failed attempts: switch to Debug mode; if still blocked, write the blocker in DECISIONS.md and move to the next independent task.
```

### 2.4 Approval settings (suggested)

- **Auto-approve:** file reads/writes inside the repo, `pnpm *`, `turbo *`, `prisma *`, `vitest *`, `docker compose` (dev file), `git add/commit/status/diff/log`.
- **Ask first:** `git push`, `docker system prune`, `rm -rf`, anything outside the repo, any command touching `.env`, new global installs.
- Turn on checkpoints/auto-commit if Kilo offers it so any task can be rolled back.

### 2.5 Context hygiene (the biggest hidden speed factor)

1. One task card per Kilo task. Finish, commit, tick `PROGRESS.md`, **end the task**.
2. Start the next task with the **Resume Prompt** (§12.2). Don't carry long chat history.
3. If context passes roughly 60–70%, wrap up the current step, commit, and restart from `PROGRESS.md`.
4. Keep large spec reads to the card's line ranges. Re-read only the subsection you need.

### 2.6 Always-fresh documentation

Spec §44 says: *"Always read the current documentation before implementing — APIs change."* If your Kilo setup supports a docs MCP server (e.g. Context7) or web fetch, enable it and have the agent check: discord.js (Components V2 builders, voice/DAVE), Prisma (current config/generator setup — recent majors changed it), `@google/genai` (Live API), Colyseus, Next.js/Auth.js. Record pinned versions in `DECISIONS.md`.

---

## 3. Spec map (line index)

Read **only** what a task card names. Regenerate this map any time:
`grep -n '^## \|^### ' docs/BOT_DESIGN_SPEC.md`

### 3.1 Top-level sections

| § | Topic | Lines | § | Topic | Lines |
|---|---|---|---|---|---|
| — | AI Builder Brief (B.1–B.8) | 37–115 | 22 | Nova text Companion | 2328–2427 |
| 0 | Glossary | 195–224 | 23 | File understanding | 2429–2473 |
| 1 | Principles P1–P10 | 226–260 | 24 | AI admin tools | 2475–2503 |
| 2 | Tech stack | 262–293 | 25 | Economy | 2505–2555 |
| 3 | Architecture | 295–368 | 26 | Shopkeeper | 2557–2641 |
| 4 | Repo structure | 370–444 | 27 | Mini-games | 2643–2684 |
| 5 | Dev setup | 446–532 | 28 | Hollowdeep core | 2686–2824 |
| 6 | Core framework | 534–666 | 29 | Voice Companion | 2826–2952 |
| 7 | Database (schema 684–1302, Redis 1303–1324) | 672–1324 | 30 | Profile/badges/achievements | 2954–2972 |
| 8 | Config engine & Smart Profiles | 1326–1495 | 31 | i18n | 2974–2985 |
| 9 | Setup wizard & `/settings` | 1497–1547 | 32 | Dashboard | 2987–3026 |
| 10 | Manual moderation | 1549–1650 | 33 | Security | 3028–3046 |
| 11 | AutoMod | 1652–1734 | 34 | Privacy & legal | 3048–3083 |
| 12 | Anti-raid / verification / anti-nuke | 1736–1807 | 35 | Testing | 3085–3101 |
| 13 | Logging | 1809–1841 | 36 | Deployment & ops | 3103–3142 |
| 14 | Mod tools | 1843–1893 | 37 | Premium | 3145–3160 |
| 15 | Advanced moderation | 1895–1948 | 38 | Roadmap | 3164–3227 |
| 16 | Welcome, roles, XP | 1950–2000 | 39 | **UI/UX design system** | 3233–3335 |
| 17 | Engagement features | 2002–2034 | 40 | Engagement design | 3337–3385 |
| 18 | Support tools | 2036–2080 | 41 | Nova experience | 3387–3455 |
| 19 | Integrations/backups/analytics | 2082–2118 | 42 | Hollowdeep complete | 3457–3659 |
| 20 | Reputation | 2120–2221 | 43 | Game catalogue G1–G16 | 3661–3687 |
| 21 | AI service layer | 2223–2326 | 44 | Resources | 3690–3771 |
| — | — | — | 45 | **Master checklist** | 3774–4001 |
| — | Appendix A (Discord limits) | 4004–4026 | — | Appendix B (defaults) | 4028–4061 |

### 3.2 Hot subsections

| Need | Lines |
|---|---|
| Component shape of a command (`BotCommand`) | 561–581 |
| Permission levels & hierarchy rule | 596–610 |
| Component custom IDs | 612–623 |
| `messageCreate` dispatch order | 649–661 |
| Prisma schema (all models) | 684–1302 |
| Config resolution order / base table / size scaling / resolver API | 1358–1457 |
| Punishment execution order | 1586–1603 |
| AutoMod pipeline | 1657–1675 |
| Rep earning rules / multipliers / penalties / ranks | 2125–2191 |
| AI `generate()` steps / budgets / prompt structure | 2259–2314 |
| Ledger correctness | 2515–2527 |
| Shopkeeper lazy evaluation | 2592–2603 |
| Voice audio pipeline / Live session mgmt | 2862–2914 |
| Hollowdeep build order (core) / (full) | 2805–2815 / 3643–3652 |
| Hollowdeep: world / player / combat / building / crafting | 3491–3545 |
| Hollowdeep: gathering / NPCs / enemies / simulation | 3546–3594 |
| Hollowdeep: multiplayer / client UI / audio / Discord / content pipeline | 3595–3642 |
| Panel pattern / Hub / juice / onboarding | 3258–3319 |

Everything in this file is subordinate to the spec: **if a number here disagrees with the spec, the spec wins.**

---

## 4. Pinned decisions (so the agent never stalls choosing)

The spec fixes the stack. These are the *small* choices it leaves open. Adopt them, record them in `DECISIONS.md` on day one, and change only with a written reason.

| Topic | Decision |
|---|---|
| Module system | **ESM** everywhere (`"type": "module"`), `module/moduleResolution: NodeNext`, strict TS, `noUncheckedIndexedAccess` on |
| Dev runner | `tsx watch` per app; production builds with `tsup` (bundle per app) or `tsc` — pick one in T0.1 and keep it |
| Exact versions | `.npmrc` → `save-exact=true`; every dependency pinned (spec §2). Lockfile committed |
| Workspace scope | `@modest/bot`, `@modest/worker`, `@modest/voice`, `@modest/game-server`, `@modest/activity`, `@modest/dashboard`, `@modest/db`, `@modest/shared`, `@modest/config-engine`, `@modest/ai`, `@modest/i18n`, `@modest/cards`, `@modest/game-data` |
| Lint/format | ESLint (flat config) + Prettier; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` at repo root via Turborepo |
| IDs & time | Snowflakes as `string`; timestamps stored UTC; display with Discord `<t:…>` |
| Schema strategy | **Port the entire spec §7.2 Prisma schema in T0.3**, migrate once, add further migrations only for genuinely new tables/columns. (Spec B.4 allows per-feature migrations; one up-front schema avoids ~40 tiny migrations. Record in `DECISIONS.md`.) |
| Prisma setup | Follow the **current** Prisma quickstart for the installed major (config/generator/driver setup differs between majors) |
| Test layout | `*.test.ts` next to the file; integration tests `*.int.test.ts` using Testcontainers; shared fakes in `packages/shared/test/fakes` |
| Errors | Typed `AppError(code, userMessageKey)`; router converts to friendly error panel with 8-char error code (spec §6.3) |
| Feature flags | Every module has an entry in `GuildConfig.modules` (spec §6.9); every command declares `module` |
| i18n keys | `packages/i18n/locales/en/<module>.json`; key style `module.feature.message` |
| Content data | Items/recipes/monsters/buildings/cards/pets as JSON in `packages/game-data`, validated by Zod at build time (spec §42.16) |
| Commit style | Conventional Commits; one commit per task card; body lists the checklist IDs |

---

## 5. Architecture cheat-sheet (so every task starts with the right mental model)

- **6 apps:** `bot` (gateway, commands, moderation, Nova text, chat games) · `worker` (BullMQ, **REST only**) · `voice` (Opus ↔ Gemini Live, separate process, P9) · `game-server` (Colyseus, server-authoritative) · `activity` (Phaser client in a Discord iframe) · `dashboard` (Next.js).
- **7 packages:** `db`, `shared` (env, logger, types, **ui helpers**), `config-engine`, `ai`, `i18n`, `cards` (canvas images), `game-data`.
- **Flow:** Discord → `interactionRouter` → middleware (guildOnly → loadConfig → permissions → cooldown) → command → service (pure logic) → repository (Prisma) → reply via UI helpers. (Spec §3.3, §6.)
- **State:** Postgres = truth; Redis = cache, counters, cooldowns, pub/sub, BullMQ. Config cache invalidated via `config:changed:{guildId}`.
- **Message pipeline order** (spec §6.10): ignore bots → AutoMod (may stop) → rep + XP → Nova → custom commands → sticky → analytics; steps after AutoMod run with `Promise.allSettled`.
- **AI rule:** AI output never triggers an action; deterministic code/humans do (P6).

---

## 6. Dependency map and parallel lanes

```
Phase 0  ──►  Phase 1 ─────────────────────────────────────────────┐
(scaffold)    1A staff+hierarchy ─┐                                 │
              1B config engine ───┼─► 1C wizard/settings            │
                                  ├─► 1D moderation (+1E worker)    │
                                  ├─► 1F AutoMod                    │
                                  ├─► 1G antiraid/verification      │
                                  └─► 1H logging, 1I perm-doctor    │
              1J voice spike (independent, time-boxed)              ▼
Phase 2 (needs 1A–1D) ─► Phase 3 (needs 1B, UI kit) ─► Phase 4 (needs economy ← 2 rep/XP optional)
                                                        │
Phase 5 voice (needs 3 AI layer + 1J spike)             │
Phase 6 Hollowdeep core (needs 0, 4 economy for bank)   │
Phase 7 lanes A–J run in parallel once their prerequisites are ticked
```

**Parallelisation rules (use Orchestrator to run 2–3 sub-tasks at once):**
1. Two tasks may run in parallel only if they touch **different modules and different Prisma models**. If they both need a schema change, do the schema task first.
2. Never run two tasks that edit `schema.prisma`, `packages/shared/src/ui/*`, or `COMMANDS.md` at the same time — serialize those edits or merge via a short "integration" task.
3. Git: one branch per task (`task/T1.5-moderation`), merge to `main` only when gates are green.
4. Good parallel pairs: *(Dashboard ‖ any bot phase)*, *(Hollowdeep client ‖ game-server)* once the Colyseus schema is agreed, *(content JSON ‖ engine code)*, *(i18n strings ‖ UI wiring)*.

---

## 7. Task cards by phase

**Card format:** `Read` = spec line ranges to load · `IDs` = checklist items it completes · `Build` = deliverables · `Gate` = what must pass · `Watch` = known traps.

### Phase 0 — Scaffold (do first, serially)

#### T0.1 Monorepo skeleton — `CORE-01`
- **Read:** §2 (L262–293), §4 (L370–444), §35 (L3085–3101).
- **Build:** pnpm workspace + Turborepo (`pnpm-workspace.yaml`, `turbo.json`), root `tsconfig.base.json`, ESLint + Prettier, `.gitignore` (incl. `.env`), `.npmrc` (`save-exact=true`), empty app/package folders per spec §4 with `package.json` scoped `@modest/*`.
- **Gate:** `pnpm install && pnpm lint && pnpm typecheck && pnpm build` green on empty packages.
- **Watch:** Pin exact versions. Choose the build tool once and record it.

#### T0.2 `packages/shared` — `CORE-02`
- **Read:** §5.4 (L476–513), §6.11 (L663–666), §36.4 (L3119–3122).
- **Build:** `env.ts` (Zod-validated; refuses to start if required vars missing; per-app required sets), `logger.ts` (pino; fields `service, module, guildId, userId, event, durationMs, err`; **no message content at info**), Sentry init helper, shared types (`BotCommand`, `CommandContext`, `ModuleName`), `.env.example` exactly as spec §5.4.
- **Gate:** unit tests for env validation (missing/invalid vars).

#### T0.3 `packages/db` — `CORE-08`, `CORE-09`
- **Read:** §7 (L672–1324) — all of it, once.
- **Build:** Prisma schema ported **in full** from §7.2, first migration, generated client export, singleton Prisma client, Redis client + key helper functions for §7.3 conventions, seed script (one dev guild).
- **Gate:** `pnpm --filter @modest/db prisma migrate dev` works on a clean Docker Postgres; a test proves `CaseCounter` atomic increment under concurrency (Testcontainers).
- **Watch:** All IDs as `String`. Add indexes spec mentions. Don't hand-edit migrations after merge.

#### T0.4 Bot core framework — `CORE-03`, `CORE-05`, `CORE-06`, `CORE-07`
- **Read:** §6 (L534–666), §3.3 (L355–366), Appendix A (L4004–4026).
- **Build:** `client.ts` (intents exactly as §6.1, `allowedMentions: { parse: [] }`), `commandRegistry` (auto-discovers each module's `index.ts` exports), `interactionRouter` (slash, context menu, autocomplete, button/select/modal by customId prefix; try/catch → friendly error panel + 8-char code + Sentry), middleware chain, `componentIds.ts` (`encodeId/decodeId`, ≤100 chars, ownership helper), `reply.ts`, `ctx.confirm()` (60 s expiry), Redis cooldowns (`SET NX EX`), module enable/disable guard, `/ping`, `register-commands` script (guild in dev, global in prod; **hash command JSON so it only re-registers on change**).
- **Gate:** router unit tests with the Discord fakes; `/ping` works in the dev guild; error path shows code.
- **Watch:** The 3-second rule — defer automatically when `defer` is set. Never register commands on every boot.

#### T0.5 UI kit (`packages/shared/src/ui`) — `CORE-11` (part 1)
- **Read:** §39 (L3233–3335). Check the **installed discord.js** supports Components V2 builders (`ContainerBuilder`, `SectionBuilder`, `TextDisplayBuilder`, `MediaGalleryBuilder`, `SeparatorBuilder`, `ThumbnailBuilder`) and the `IS_COMPONENTS_V2` flag.
- **Build:** `emoji.ts` (Unicode fallbacks + app-emoji map), `colors.ts` (brand `#7C5CFF`, success `#3BA55D`, danger `#ED4245`, warning `#FAA61A`, info `#5865F2`, gold `#F5C542`, rep `#2ECC71`), `progressBar(value,max,width=10)`, `formatNumber()` (K/M/B/T/Qa/Qi), `timestamp()` helpers (`<t:UNIX:R/f>`), `panel()` builder (container + accent + header + body + action rows), **navigation stack in Redis** (`panel:{messageId}`, TTL 15 min), pagination (`⏮ ◀ Page n/N ▶ ⏭`), ownership guard ("Open your own with `/menu`"), expiry handler (disable components after 15 min idle), error panel, loading-state button helper, `reducedMotion` check, **classic-embed helper for logs**.
- **Gate:** snapshot tests of panel JSON; a demo `/uikit-demo` dev command renders every helper (remove before release or keep dev-only).
- **Watch:** V2 messages cannot also carry `content`/`embeds`. Max 1 edit/sec/message, ≤3 edits per animation. Test desktop **and** mobile.

#### T0.6 Generators and test fakes — speed multiplier
- **Build:** `pnpm gen:module <name>` creates the §4.1 folder layout with typed stubs (`commands/`, `components/`, `events/`, `service.ts`, `repository.ts`, `schemas.ts`, `jobs.ts`, `index.ts`, i18n file, test stub). `packages/shared/test/fakes` with fake `Interaction`, `Guild`, `Member`, `Message`, `Channel`, `Role`. A `pnpm test:int` script that starts Testcontainers Postgres/Redis.
- **Gate:** generating a throwaway module compiles and its stub test runs.

#### T0.7 Docker, CI, README — `CORE-01`
- **Read:** §5.5 (L515–523), §36 (L3103–3142).
- **Build:** `docker/docker-compose.dev.yml` (Postgres 16 + Redis 7 with health checks), `docker/docker-compose.yml` skeleton, `.github/workflows/ci.yml` (install → lint → typecheck → test with service containers → build images on `main`), `README.md` with Section 5 steps, `/healthz` pattern stub.
- **Gate (Phase 0 "Done when", spec §38 L3175):** a fresh clone → README steps → `/ping` in **< 30 minutes**; CI green.

---

### Phase 1 — Foundation (protect a real server with only the wizard)

**Gate for the phase (spec §38 L3187):** the bot protects a 500-member server with just the setup wizard. Run the load script (100 messages/s into the AutoMod pipeline, spec §35) before closing the phase.

#### T1.1 Staff levels & hierarchy — `CORE-04`
- **Read:** §6.4 (L596–610), §7.2 `Guild/GuildConfig/Member`.
- **Build:** `resolveStaffLevel(member)` = max over roles; owner always `owner`; Redis cache `staff:{guildId}:{userId}` (60 s) invalidated on `GuildMemberUpdate` and config change; `checkHierarchy(actor, target, bot)` implementing rules (a)–(d) with **specific, actionable error text** ("Move my role above **Members**…").
- **Gate:** table-driven tests covering owner target, self target, equal role, bot-below-target.

#### T1.2 Config engine & Smart Profiles — `CFG-01…07`
- **Read:** §8 (L1326–1495) fully; §7.2 `GuildConfig`, `ConfigHistory`, `TemporaryBoost`; §20.6 (L2193–2203) for the trust-shift hook (stub it).
- **Build:** `packages/config-engine`: size-tier detection (auto + override), strictness levels, `resolve(guildId, context)` implementing resolution order (base table → size scaling → guild overrides → channel overrides → trust shift → temporary boost), config history + undo, adaptive size suggestions, monthly strictness recommendation, `/strictness boost` TemporaryBoost with expiry job hook. Redis cache + `config:changed:{guildId}` publish/subscribe.
- **Tests (required, spec §35):** *all* strictness × size combinations; override precedence; channel override; boost expiry; undo restores previous value; ≥80% coverage.
- **Watch:** Port the **base table (L1381–1436)** as typed data, not prose. Safe defaults (P3): nothing destructive unless Strict/Lockdown.

#### T1.3 Setup wizard & `/settings` — `CFG-08`, `CFG-09`
- **Read:** §9 (L1497–1547), §39.4 (L3258–3281).
- **Build:** wizard with pickers only (P1: no typing IDs), presets, **preview of resulting settings** before apply, 60-second target flow; `/settings` panel with categories, "custom" badges on overridden values, per-setting reset, config history/undo; re-runnable.
- **Gate:** wizard produces a valid GuildConfig through the resolver; undo works; every control is a role/channel/user picker.

#### T1.4 Worker + BullMQ — `CORE-10`
- **Read:** §3 (L295–353), §10.7 (L1633–1636).
- **Build:** `apps/worker` (**Discord REST only**), queue definitions per module (`moderation`, `reminders`, …), job registration from each module's `jobs.ts`, retries/backoff, **recovery sweep on boot** (re-enqueue overdue tempbans/unbans from DB so Redis loss never strands a punishment), graceful shutdown, `/healthz`.
- **Gate:** integration test: schedule unban in 2 s → executes; kill Redis state → sweep recovers it.

#### T1.5 Manual moderation, cases, warnings — `MOD-01…13`
- **Read:** §10 (L1549–1650); §6.4; §7.2 `Case`, `CaseCounter`; §39.8 (L3320–3324).
- **Build:** service functions first (`applyPunishment` following the exact **execution order L1586–1603**: validate hierarchy → DM *before* removal → call Discord → create Case in a transaction → rep penalty hook → enqueue job → log → reply with Undo). Commands: warn, timeout/untimeout (duration parser), kick, ban (incl. by ID, delete-message days, tempban), softban, unban (autocomplete), massban (confirm), purge (modes, 14-day handling), lock/unlock/lockdown, slowmode, nick, case view/edit/delete/history, user & message context menus with quick panels (≤2 clicks), `/modstats` stub. Warning points with expiry + escalation ladder. Undo for every type.
- **Gate:** concurrency test for case numbers; undo restores state; DM-fail path doesn't block action; hierarchy errors are specific.
- **Watch:** Discord bulk delete only for messages < 14 days. Timeout max 28 days. Ban message deletion ≤ 7 days. Helpers can time out ≤ 1 h (§6.4).

#### T1.6 AutoMod core — `AM-01…11`, `AM-14`, `AM-15`
- **Read:** §11 (L1652–1734); §6.10; §8.4 (rows used by AutoMod); §7.2 `AutomodRule`, `AutomodHit`.
- **Build:** the pipeline `automod.handleMessage` in spec order; exemptions; phishing/scam list with **hourly refresh job** and report-domain; invite filter (own-server invites allowed); link policy; mention spam; rate spam; duplicate & cross-channel spam (Redis sliding windows); caps/emoji/newlines/zalgo; bad-word filter (normalisation, leetspeak, **Scunthorpe allowlist**, per-language lists); custom rules via **`re2`** with shadow flag; actions + public notice (deleted after 8 s) + DM explanation + log embed with **Undo / False positive** buttons; repeat escalation (3 hits/10 min → one step stricter); Discord-native AutoMod sync; dangerous-file warnings. AI context review (AM-12) and media scan (AM-13) are **Phase 7** — leave interfaces only.
- **Gate:** per-check unit tests with positive/negative samples; load test 100 msg/s with p95 check time recorded; no catastrophic regex possible (re2 only).
- **Watch:** Never ping; never log message content at info; stop the pipeline once a message is deleted.

#### T1.7 Anti-raid & verification — `SEC-01…03`
- **Read:** §12.1–12.2 (L1738–1783), §12.4 (L1802–1807).
- **Build:** join-spike detection with rolling baseline (Redis), suspicion scoring, raid actions + alert panel with buttons (lockdown, kick new, dismiss), raid boost duration 15 min; verification gate (button, captcha image via `packages/cards`, quiz, account-age rule, kick-after 30 min — off in Relaxed).
- **Gate:** simulated join flood triggers raid mode and auto-expires; verification kick job survives restart.

#### T1.8 Logging — `LOG-01…05`
- **Read:** §13 (L1809–1841).
- **Build:** categories → channels, per-category toggles/ignore lists, message edit/delete/bulk-delete, member join/leave/nick/avatar + **invite tracking**, roles/channels/voice/invites/server/emoji, size-based verbosity, **batching through webhooks** to dodge rate limits, ghost-ping detection. Classic embeds.
- **Gate:** burst of 200 events is batched without rate-limit errors.

#### T1.9 Permission Doctor — `MOD-19`
- **Read:** §14.6 (L1871–1886), §5.2 (L465–467).
- **Build:** `/checkperms` compares required bot permissions per enabled module per channel; **one-click fixes** where the bot can apply them; clear explanation where it cannot (role order).

#### T1.10 i18n foundation — part of `CORE-13`
- **Read:** §31 (L2974–2985).
- **Build:** `packages/i18n` with i18next, `ctx.t()`, localized command descriptions scaffold, lint rule/test that flags hard-coded user strings.

#### T1.11 Voice spike (time-boxed, independent) — de-risks Phase 5
- **Read:** §29.2–29.5 (L2846–2914), §3.1 note (L343).
- **Build:** a throwaway `apps/voice` proving: join channel (not self-deafened), `receiver.subscribe` per user, Opus → PCM → 16 kHz mono, and playback of a PCM stream. Confirm the **DAVE/E2EE dependency** the current `@discordjs/voice` requires. Write findings to `DECISIONS.md`.
- **Gate:** you can hear yourself echoed back from a test channel. Do not build features on it yet.

---

### Phase 2 — Community

#### T2.1 Hub skeleton & onboarding — `CORE-12`, `SUP-08`
- **Read:** §39.5–39.7 (L3282–3319).
- **Build:** `/menu` Hub with tab buttons that **register themselves** (each feature adds its tab), red-dot indicators, staff-only settings button, optional persistent `#start-here` panel with "Open my hub"; 4-step first-run tour (Skip tour; "Explorer" badge + 100 coins once economy exists); first-use tips.

#### T2.2 Reputation — `REP-01…06`, `SEC-05`
- **Read:** §20 (L2120–2221); Appendix B rep rows (L4037–4042); §7.2 `RepEvent`.
- **Build:** earning sources with daily caps, multipliers & anti-farming, penalties + **undo restores**, ranks/rank roles/perks, trust shift wired into the config resolver (replacing the T1.2 stub), compromised-account detection, `/rep` commands with transparency view and hidden negative values.
- **Watch:** Rep is **never** convertible to coins (§25.2). Rep floor −500. AI can never change rep (P6).

#### T2.3 XP & levels — `COM-04`
- **Read:** §16.4 (L1974–2000); Appendix B (L4043–4044).
- **Build:** 15–25 XP per message with 60 s cooldown, formula `5L² + 50L + 100`, voice XP, multipliers, level roles, `/rank`, leaderboards, level-up card.

#### T2.4 Profile card, badges, achievements — `ECO-10`
- **Read:** §30 (L2954–2972); §39.6 (L3301–3312).
- **Build:** `packages/cards` profile/rank/level-up/badge cards (2× resolution, Inter + Noto fonts), badge catalogue (target 150+, data-driven), achievements (30), rarity glow, alt-text under every image.

#### T2.5 Welcome, auto-roles, role menus — `COM-01…03`
- **Read:** §16.1–16.3 (L1952–1973).

#### T2.6 Mod tools — `MOD-14`, `MOD-15`, `MOD-16`
- **Read:** §14.1–14.4 (L1845–1870).
- **Build:** notes, reports (queue, claim, escalation, reporter feedback), `/modstats`.

#### T2.7 Anti-nuke — `SEC-04`
- **Read:** §12.3 (L1784–1801).
- **Build:** audit-log-driven detection of mass channel/role deletes and bans, trusted users, bot-add protection, automatic stripping of dangerous perms from the offender (**deterministic code, not AI**), owner alert.

#### T2.8 Counting — `GAME-21`
- **Read:** §43 G13 (L3679).

**Phase 2 gate:** rep, XP, Hub and profile all visible from `/menu`; anti-nuke tested on a throwaway server by deleting channels with a test admin.

---

### Phase 3 — AI Companion (text)

**Gate for the phase:** consent/budget/circuit-breaker behaviour verified with mocked Gemini; prompt-injection eval set passes against the real API once; Nova works in a test server without ever taking a moderation action.

#### T3.1 `packages/ai` — `AI-01`
- **Read:** §21 (L2223–2326), Appendix B Nova rows (L4045–4050), §7.2 `AIUsage`, `CompanionConfig`.
- **Build:** typed `generate()` wrapper around `@google/genai` implementing the **processing steps (L2259–2268)**: consent check → budget check → cooldown → sanitise input → build prompt (**fixed structure, L2285–2314**: hard rules → persona → server knowledge → memory → user message, with user content clearly delimited as data) → call → Zod-validate structured output → output filter → record `AIUsage`. Budgets: per-user 30/day, per-guild 300/day, global `AI_GLOBAL_DAILY_REQUEST_LIMIT`, cooldown 8 s, reply cap 1,500 chars. **Circuit breaker** (open on repeated failures, friendly fallback message). Models only from env.
- **Gate:** mocked-SDK tests for every rejection path (no consent, over budget, cooldown, breaker open, filter hit, invalid JSON → retry/fallback).
- **Watch:** Free-tier Gemini may train on prompts → consent notice (§21.6, L2316–2320) must say so when applicable.

#### T3.2 Nova chat — `AI-02`
- **Read:** §22.1–22.4 (L2330–2364).
- **Build:** triggers (mention, reply, dedicated Nova channel, DM), personas, conversation context window, server knowledge (rules/FAQ/channels) with "answer only from knowledge or say you don't know".

#### T3.3 Memory, tools, proactive — `AI-03`, `AI-04`, `AI-05`
- **Read:** §22.5–22.7 (L2360–2385).
- **Build:** opt-in memory (max 20 facts/user), **sensitive-data exclusion** (health, politics, religion, sexuality, precise location, credentials…), user controls (view/edit/delete); **read-only** function-calling tools (no write tools, ever); proactive behaviour only when `proactive = true` with rate caps.

#### T3.4 Bonds, streaks, quests — `AI-06`
- **Read:** §22.8 (L2386–2411); §7.2 `CompanionBond`, `Quest`.

#### T3.5 File & attachment understanding — `AI-07`
- **Read:** §23 (L2429–2473).
- **Build:** supported inputs, 3-request cost per file, size/type limits, safe handling (never execute files; dangerous-extension warnings), result panels.

#### T3.6 Nova experience — `AI-10…14`
- **Read:** §41 (L3387–3455).
- **Build:** character bible & persona files (`personas/*.md`, versioned), portrait/mood images (original art — placeholders OK), `/nova` Hub, rich replies (**regenerate, continue, speak, feedback, suggestion chips**), fun commands, gifts, diary, milestones, outfits.

#### T3.7 Wellbeing & injection suite — `AI-15`, `AI-16`
- **Read:** §41.8 (L3443–3449), §22.11 (L2422–2427), §21.5.
- **Build:** crisis/wellbeing guardrails (supportive redirect, no roleplay of self-harm, under-13 hard stop), **prompt-injection test suite** (hidden instructions in messages, files, usernames, memory), run manually against the real API before the phase closes.

#### T3.8 Privacy basics — part of `PLAT-04`
- **Read:** §34 (L3048–3083).
- **Build:** `/privacy`, `/forget-me` (full erase with confirm), `/my-data` (export), retention jobs skeleton, policy/terms templates in `docs/legal/`.

#### T3.9 Nova's Arcade — `GAME-24`
- **Read:** §43 G16 (L3682).

---

### Phase 4 — Economy & games

**Gate for the phase:** economy invariants hold under concurrency; every game pays through the ledger and respects daily caps (coins 2,000/day from mini-games, season XP 600, `event` rep 10).

#### T4.1 Economy & ledger — `ECO-01…04`
- **Read:** §25 (L2505–2555); §7.2 `Wallet`, `LedgerEntry`, `InventoryItem`; Appendix B coin rows (L4051–4052).
- **Build:** wallets with **row locking** (`SELECT … FOR UPDATE` inside a transaction), append-only ledger (every coin movement, with reason + source), daily (100 + 10 × streak, bonus capped at 200), weekly, work (1 h cooldown), chat earnings, server shop, `/pay`, inventory, anti-abuse and inflation sinks.
- **Gate:** Testcontainers test: 100 concurrent spends never overdraw; sum(ledger) == wallet balance after random operations (property test).
- **Watch:** **Coins ≠ rep ≠ XP** (§25.2). No path converts rep to coins.

#### T4.2 Shopkeeper — `GAME-01`
- **Read:** §26 (L2557–2641); Appendix B (L4053–4056).
- **Build:** *Architect step first:* decide the big-number type (BigInt or a fixed decimal/mantissa-exponent scheme — spec formats up to Qi) and record it. Lazy-evaluation production (no per-tick loops): `state + elapsed × rate`, offline cap 8 h at 50 %, cost growth ×1.15, upgrades, prestige (+2 %/star), orders, server goal, themes, balancing simulator script (`pnpm sim:shopkeeper`) to verify pacing.
- **Gate:** deterministic simulation tests; no float drift; panel updates within 3 s.

#### T4.3 Engagement systems — `ECO-05…09`
- **Read:** §40 (L3337–3385).
- **Build:** free Season Pass (earned by playing only), collections, streaks with freezes & repair, opt-in reminders with quiet hours, **guardrails (§40.7, mandatory): odds shown, break reminders, leaderboard opt-out, no real-money mechanics, no buying power**.

#### T4.4 Mini-games — `GAME-02…08`
- **Read:** §27 (L2643–2684), §43 header (L3661–3687).
- **Build (each: `rules.md`, Zod content JSON, pure `service.ts` + tests, panel UI):** trivia (Open Trivia DB with attribution), hangman, word chain, anagram, tic-tac-toe & connect four (incl. vs Nova), RPS, fishing/mining/foraging/crafting, AI story adventure (AI never changes balances), trading (two-sided confirm, anti-scam).
- **Watch:** Rewards only through the ledger; stats in `GameStat`.

#### T4.5 Catalogue games for Phase 4 — `GAME-09`, `-10`, `-14`, `-15`(Five), `-20`, `-22`, `-18`
- **Read:** §43 G1 (L3667), G2 (L3668), G6 (L3672), G7 (L3673), G10 (L3676), G12 (L3678), G14 (L3680).
- **Order:** Five (smallest) → Chess/Checkers (use `chess.js`) → Pet Pals → Farmstead → Server Pet → Last Standing → Typing Race.
- **Note on IDs:** in `PROGRESS.md`, GAME-14 is *Chess & checkers*, GAME-15 *Five*, GAME-18 *Last Standing*, GAME-20 *Server Pet*, GAME-22 *Typing Race*. Match by name, not by guess.

---

### Phase 5 — Voice Companion

**Gate for the phase:** consent-first voice works end-to-end in a real voice channel; a crash of `apps/voice` leaves moderation running (P9).

#### T5.1 Voice service & Redis commands — `VOX-01`
- **Read:** §29.3 (L2854–2861), §3.2 (L345–353).
- **Build:** production `apps/voice` (gateway with only `Guilds` + `GuildVoiceStates`), Redis `voice:command` in / `voice:status` out, `/voice join|leave|consent|mode` in the bot, auto-leave after 2 min alone, max 1 session/guild, `VOICE_MAX_SESSIONS`, `/healthz`.

#### T5.2 Consent & indicators — `VOX-02`
- **Read:** §29.2 (L2846–2853).
- **Build:** join notice with **Opt in / How it works**, spoken notice, per-member `voiceOptIn` **and** `aiDataConsent`, non-consenting audio never subscribed, nickname suffix "🔴 listening", under-13 hard stop.
- **Watch:** Never write audio to disk. No audio buffers kept beyond the utterance.

#### T5.3 Audio pipeline & Gemini Live — `VOX-03`
- **Read:** §29.4–29.5 (L2862–2914).
- **Build:** subscribe per consenting user with end-after-silence 800 ms → Opus decode → stereo→mono → 48→16 kHz → Live `sendRealtimeInput`; reverse path 24→48 kHz, mono→stereo, `PassThrough` stream to the audio player so playback starts early; transcription enabled; **one Live session per channel**; session resumption on `goAway`.
- **Gate:** unit tests for resamplers with known vectors; manual latency measurement recorded in `DECISIONS.md`.

#### T5.4 Floor control & modes — `VOX-04`
- **Build:** push-to-talk (button, 10 s window), name-detection conversation mode (fall back to PTT default if unreliable), floor control with `[Speaker: name]` turns, **barge-in** (`interrupted` → stop player, flush queue).

#### T5.5 Personas, transcripts, fallback — `VOX-05`, `VOX-06`
- **Build:** voice personas (`voiceName`), optional transcripts (not stored unless a feature needs them), `VoiceBrain` interface with Live implementation and **STT → `generate()` → TTS fallback**, selectable by config; output-transcript filter stops playback on blocked terms.

---

### Phase 6 — Hollowdeep (Acts I–II) — the biggest feature

> Run Hollowdeep as its **own Orchestrator project** with its own sub-tasks. Keep the engine generic and content data-driven so Acts III–IV are mostly JSON + behaviour scripts.
> **Read first (once):** §28 (L2686–2824) and §42.1–42.2 (L3457–3490). For each card below read only the named subsection.

| Card | Deliverable | Read | IDs |
|---|---|---|---|
| **H1** Activity hello world | Vite + Phaser app; Discord SDK `ready()`, OAuth → token exchange via backend; show username | §28.2–28.3 (L2696–2731) | HD-01 |
| **H2** Client-only movement | Tilemap, player physics, camera on a static map; Kenney CC0 placeholders; log licences in `apps/activity/ASSETS_LICENSES.md` | §42.13 (L3601–3608) | HD-18 (part) |
| **H3** Authoritative multiplayer | Colyseus room; schema for players/inputs; **inputs not positions** from client; server validates speed/reach; client prediction + reconciliation + interpolation; 8 players, 20 TPS | §28.3, §42.11–42.12 (L3583–3600) | HD-02 |
| **H4** World & chunks | Seeded generation with `simplex-noise`; sizes; Act I biomes; underground variants; structures; chunk streaming; periodic + shutdown persistence (`SandboxWorld/Chunk/Player`); mining/placing with server validation | §28.4 (L2732–2751), §42.3 (L3491–3503) | HD-03, HD-04 |
| **H5** Content pipeline | `packages/game-data` Zod schemas (items, recipes, tiles, enemies, NPCs, bosses, loot), validators (duplicate IDs, dangling references, unreachable recipes), **seed soft-lock test** (every required item obtainable across 100 seeds) | §42.16 (L3620–3642), §42.18 | HD-22 |
| **H6** Player, items, crafting | Health/mana, inventory/hotbar, equipment & accessories, buffs, tool tiers gating ores, crafting stations + recipe browser, death modes | §42.4, §42.7 (L3504–3518, 3540–3545) | HD-05, HD-10 |
| **H7** Combat & enemies | Weapon classes, Tempering (prefixes) data, enemy AI archetypes, spawn rules per biome/time, drops, banners, bestiary | §42.5, §42.10 (L3519–3527, 3577–3582) | HD-06, HD-12 |
| **H8** Building & simulation | Blocks, walls, furniture, slopes, paint, lighting; **liquids, falling blocks**, light propagation, weather, moon phases (all server-side tick budgeted) | §42.6, §42.11 (L3528–3539, 3583–3594) | HD-07, HD-15 |
| **H9** Act I content | Bosses 1–4 (2–3 phases each, unique drops), NPCs & housing/happiness/shops, gathering (herbs, trees, farming, fishing, critters) | §42.2, §42.8–42.9 (L3546–3576) | HD-09, HD-11, HD-13 (part) |
| **H10** Act II | The Hollow, Emberheart, **world awakening**, spreading Blight/Radiance biomes | §42.2–42.3, §42.11 | HD-14, HD-13 (part) |
| **H11** Chat mode | Server-rendered tile view via `packages/cards`, buttons for move/mine/place, shares the same world | §28.11 (L2793–2799) | HD-21 |
| **H12** Bot integration | Launch panel, announcements (first boss kills), weekly boss, coin bank, badges | §28.10 (L2786–2792), §42.15 (L3614–3619) | HD-20 |

**Hollowdeep gates (spec §28.14 L2816–2822, §42.18):** 8 players mine/build without visible desync at up to 150 ms latency; world survives a server restart with all edits; **cheat test** (teleport / unreachable mining / item duplication inputs) rejected; determinism test (same seed → same chunk hash); performance targets in §28.12 (L2800–2804) met.

**Watch:** Server is the only authority (inventory, drops, damage). Cap per-tick work; stream chunks, never the whole world. Original names/art/sounds only (spec B.3 #9); keep an asset licence log.

---

### Phase 7 — Next level (parallel lanes; start each when its prerequisites are ticked)

| Lane | Scope | Read | IDs | Needs |
|---|---|---|---|---|
| **A Dashboard** | Next.js App Router + Auth.js (Discord) + Tailwind; **server-side permission checks on every action** (never trust the browser); pages per §32.2; appeals page; UX rules §32.4; config saves publish `config:changed:{guildId}` | §32 (L2987–3026), §33 | PLAT-01, PLAT-02, MOD-17 | Phase 1 (can start after T1.3) |
| **B Support & community** | Tickets, modmail, custom commands/auto-responders, embed builder, scheduled & sticky messages, help channels, temp voice, starboard, birthdays, polls, giveaways, suggestions | §17–18 (L2002–2080), §20.2 help-channel rep | SUP-01…07, COM-05…10 | Phase 2 |
| **C Integrations** | Social feeds (`rss-parser`), outgoing webhooks, backups & restore, analytics, weekly health report, friends/rivals/gifting | §19 (L2082–2118), §40.5 | COM-11…15 | Phase 2 |
| **D Advanced moderation** | Risk score, Mod Review Queue (claim), raid prediction, shadow mode, shared ban network (2-guild confirmation + appeals), AI context review, media scan, rule simulator, staff activity | §15 (L1895–1948), §11.6–11.7, §14.5, §14.7 | SEC-06…10, AM-12, AM-13, MOD-18, MOD-20 | Phases 1–3 |
| **E AI admin** | Config assistant (**diff preview, human applies**), Mod copilot, `/why`, Nova server-knowledge answers | §24 (L2475–2503) | AI-08, AI-09, SUP-09 | Phase 3 |
| **F Advanced voice** | Live translation, call summaries (transcript deleted after summary), voice moderation in monitored channels, voice games, voice mod commands with confirmation | §29.7 (L2918–2933) | VOX-07…11, GAME-23 | Phase 5 |
| **G Hollowdeep Acts III–IV** | Awakened world ores/biomes, wiring, wings, mounts, Tempering UI, accessory combining, Heroic/Mythic, Starfall Siege, Hollow King, events, seasonal nights, bestiary completion, blueprints, teams/PvP/map/claims/world moderation/chat bridge, audio, gamepad & touch, polish | §42.2–42.17 | HD-08, HD-13 (rest), HD-16, HD-17, HD-18, HD-19 | Phase 6 |
| **H Extra games** | Dungeon Delve, Card Clash, Moonlit Village, Doodle Dash, Sky Racers, Heist Crew | §43 (L3669–3681) | GAME-11, -12, -13, -16, -17, -19 | Phase 4 (Activity games need H1 pattern) |
| **I Platform** | Security controls, retention jobs, deployment & backups, monitoring/alerts, sharding readiness, premium tier, accessibility, extra languages | §33, §34, §36–37, §31, §39.9 | PLAT-03…08, CORE-13/14 | any time |

*(GAME-11…13 mapping: Dungeon Delve, Card Clash, Moonlit Village are in `PROGRESS.md` as GAME-11/12/13 — match by name when ticking.)*

**Final phase — Release audit:** run the Phase Audit Prompt (§12.3) over *every* checklist ID; run the release checklist (spec §35) on a staging server; screenshot-review every panel on desktop, mobile, light and dark.

---

## 8. The per-task workflow (identical for every card)

Derived from spec B.4 (L74–86). The agent runs this loop **inside each task**:

```
1. READ     the card + the spec line ranges it names + §39 (UI) + the checklist IDs it completes.
2. PLAN     (Architect, only if new models/algorithms) 5–10 lines in DECISIONS.md.
3. SCHEMA   Prisma change only if the model is truly new → migration.
4. LOGIC    service.ts (pure) + unit tests FIRST.
5. DATA     repository.ts + integration tests (Testcontainers) where DB behaviour matters.
6. UI       commands/ + components/ using shared UI kit; panels per §39; i18n keys (en).
7. CONFIG   settings in the Zod schema + /settings category (+ dashboard entry later).
8. WIRE     export from module index.ts; add commands to COMMANDS.md; add Hub tab if member-facing.
9. GATE     pnpm lint && pnpm typecheck && pnpm test  (and test:int if DB logic changed).
10. VERIFY  walk every "Done when" bullet of the spec section; try the happy path + 2 edge cases in the dev guild.
11. RECORD  tick IDs in PROGRESS.md with commit hash; DECISIONS.md if anything deviated.
12. COMMIT  one conventional commit; end the Kilo task.
```

### 8.1 Delegation template (Orchestrator → sub-task)

```
TASK <T-id>: <title>
Mode: Code (or Architect first if listed)
Read ONLY: docs/BOT_DESIGN_SPEC.md lines <ranges>  (use sed -n 'A,Bp')
Also read: AGENTS.md, DECISIONS.md (pinned decisions), PROGRESS.md (current state)
Implement: <bullets copied from the card's Build>
Do NOT: touch files outside <paths>; add dependencies without recording them; stub anything.
Tests required: <from the card's Gate>
Completion criteria: all Gate items pass + every "Done when" in spec <§>.
Return: files changed, test output summary, checklist IDs completed, open questions.
```

---

## 9. Cross-cutting pitfalls (the things that silently cost days)

**Discord platform**
- Initial interaction response within **3 s**; otherwise `deferReply()`/`deferUpdate()`. Follow-up token valid **15 min**.
- Limits: message 2,000 chars · embed 6,000 total / description 4,096 / 25 fields · 5 action rows × 5 buttons · select 25 options · modal 5 inputs · autocomplete 25 · `customId` 100 chars · bulk delete only < 14 days · timeout max 28 days · ban delete ≤ 7 days (Appendix A, L4004–4026). **Re-verify against current docs**; they change.
- **Components V2 messages cannot include `content` or `embeds`.** Use V2 for panels, classic embeds for logs. Test on mobile.
- Snowflakes are **strings**; JS numbers lose precision.
- DM the user **before** ban/kick (after removal you may share no server).
- `allowedMentions: { parse: [] }` globally; opt in per message only when needed.
- Privileged intents (Members, Message Content) must be enabled in the portal *and* justified for verification at 75+ servers (spec L559).
- Don't re-register commands on boot; global registration can take up to an hour; use the dev guild while building.
- Edits are rate-limited: ≤ 1/s per message, ≤ 3 per animation.
- Audit-log reads lag a moment — retry briefly when attributing deletions/bans (anti-nuke, logging).

**Data & correctness**
- Anything money-like (coins, ledger, trades) runs in a **DB transaction with row locks**; add a property test that ledger sums equal balances.
- Case numbers via `CaseCounter` atomic increment — never `max()+1`.
- Delayed work lives in **BullMQ**, but the **DB is the source of truth**; boot sweeps must re-enqueue overdue jobs.
- Redis is a cache — losing it must not corrupt state (rebuild from DB).
- Use Redis atomics/Lua for sliding windows (spam, raid, cooldowns); avoid read-modify-write races.
- Never `JSON.parse` user/AI output without Zod.

**Security & privacy**
- Never trust `customId` arguments, dashboard form input, game-client input or AI output. Re-check permission **and ownership** server-side.
- User regex goes through **`re2`** only (ReDoS).
- Don't log message content, prompts, tokens or audio. Never store audio.
- Dashboard: verify the logged-in user has `Manage Guild`/staff level **per request** on the server side.

**AI**
- Models from env, never in code. Treat all user text, filenames, usernames and file contents as **untrusted data** inside prompts (delimited, never as instructions). No secrets in prompts.
- AI output never triggers a state change (P6). Tools exposed to Nova are **read-only**.
- Budget before call, record after call; circuit breaker returns a friendly fallback (P8).

**Voice**
- Bot must **not** be self-deafened to receive audio. Install the **DAVE/E2EE** dependency the current `@discordjs/voice` requires or voice won't connect.
- Resampling errors sound like chipmunks/robots — unit-test with known vectors.
- Floor control: one speaker forwarded at a time to the single Live session.

**Games**
- Server authoritative: client sends **inputs**, never state. Rate-limit and range-check every input.
- Determinism: world generation must be seeded and reproducible (hash test).
- Stream chunks; never serialise the whole world to clients; cap per-tick simulation cost.
- Original content only; log every asset's licence.

**Process**
- Use fake timers for cooldown/expiry tests; flaky time tests waste hours.
- Don't refactor mid-feature; log refactor ideas in `DECISIONS.md` and do them between phases.

---

## 10. Command budget & registry

Discord caps global chat-input commands at **100** (25 subcommands/groups per command, 25 options). With this feature set you **will** hit it unless you plan.

### 10.1 `COMMANDS.md` registry (agent updates it in workflow step 8)

| Command | Module | Staff level | Subcommands | Added in |
|---|---|---|---|---|
| `/ping` | core | none | — | T0.4 |

### 10.2 Budget plan

- **Top-level, high-frequency mod commands (keep short & obvious):** `/warn /timeout /untimeout /kick /ban /unban /softban /massban /purge /lock /unlock /lockdown /slowmode /nick /case /modstats` (+ 2 context menus).
- **Everything else is grouped:** `/menu /settings /setup /strictness /checkperms /automod /report /note`, `/rep` (give/show/top/…), `/rank /profile /leaderboard`, `/nova` (hub/memory/diary/…), `/voice` (join/leave/consent/mode), `/economy` (daily/work/pay/shop/inventory), `/play` or `/games` (one command, subcommand per game), `/sk`, `/ticket /modmail /poll /giveaway /suggest /birthday /starboard /embed /schedule /sticky /tempvoice /feed /backup`, `/assistant /copilot /why`, `/privacy /forget-me /my-data /help /changelog`.
- **Hard limit in CI:** a test that counts registered global chat-input commands and **fails above 90** (10 spare). Context-menu commands have their own, much smaller limits — verify the current numbers in the docs.
- Add new games as **subcommands of `/games`**, never new top-level commands.

### 10.3 Handy scripts

```bash
# list unticked checklist items
grep -n '^- \[ \]' PROGRESS.md

# tick an ID: save as scripts/tick.sh, then run ./scripts/tick.sh CFG-03 abc1234
#!/usr/bin/env bash
sed -i "s/^- \[ \] $1 \(.*\)$/- [x] $1 \1 — $2/" PROGRESS.md

# read a spec slice
sed -n '1326,1495p' docs/BOT_DESIGN_SPEC.md

# regenerate the spec section index
grep -n '^## \|^### ' docs/BOT_DESIGN_SPEC.md
```

---

## 11. Quality gates

### 11.1 Per task
`pnpm lint && pnpm typecheck && pnpm test` green · integration tests if DB logic changed · every spec "Done when" checked · IDs ticked.

### 11.2 Per phase
- All IDs for the phase ticked; `pnpm build` and Docker images build.
- Coverage ≥ **80 %** on every `service.ts` and `packages/config-engine` (spec §35).
- Phase-specific gate stated at the top of each phase above.
- Run the **Phase Audit Prompt** (§12.3).

### 11.3 Release checklist (`docs/release-checklist.md`, build in Phase 7 lane I)
- [ ] CI green on `main`; Docker images build; `prisma migrate deploy` runs **before** new containers start.
- [ ] Command registration hash changed only when definitions changed; global registration done.
- [ ] `/healthz` OK in every service; graceful shutdown verified (SIGTERM saves game rooms, closes voice).
- [ ] Load tests: AutoMod 100 msg/s; dashboard API (k6).
- [ ] Backup → **restore tested** on a scratch DB.
- [ ] Alerts fire (bot offline > 2 min, error spike, queue backlog > 1000, AI breaker open > 10 min).
- [ ] Privacy policy, terms, `/forget-me`, `/my-data`, retention jobs verified.
- [ ] Intent justification text prepared for verification.
- [ ] Prompt-injection eval re-run against the real API.
- [ ] Screenshot review of all panels: desktop, mobile, light, dark.
- [ ] Permission Doctor passes on a fresh staging server; bot never requests Administrator.
- [ ] `CHANGELOG.md` + `/changelog` updated; `ASSETS_LICENSES.md` complete.

---

## 12. Copy-paste prompts

### 12.1 Kickoff Prompt (paste once into Orchestrator mode)

```
You are the Orchestrator for building "Track Modest", a Discord bot platform, from docs/BOT_DESIGN_SPEC.md,
using the plan in docs/KILO_MASTER_PLAN.md and rules in AGENTS.md.

Do this now:
1. Read AGENTS.md and docs/KILO_MASTER_PLAN.md fully. Do NOT read the whole spec; read only the AI Builder Brief
   (spec lines 37–115) plus the slices named by each task card.
2. Create PROGRESS.md from spec §45 (command in plan §2.1), DECISIONS.md (seed it with the plan's §4 pinned
   decisions), CHANGELOG.md, COMMANDS.md.
3. Execute task cards in order starting at T0.1. For each card, delegate to a fresh Code (or Architect-then-Code)
   sub-task using the delegation template in plan §8.1. Verify its gates yourself (run lint, typecheck, tests) before
   accepting. Tick PROGRESS.md IDs with the commit hash, then move on.
4. Run independent tasks in parallel only under the rules in plan §6.
5. Stop and ask the human ONLY when: a credential/portal action is needed (plan §1), a spec ambiguity cannot be
   resolved by Appendix B → safest → simplest, or a gate fails twice after Debug mode.
6. At the end of each phase, run the Phase Audit Prompt (plan §12.3) and report.
Never stub a checklist item. Never hard-code Gemini model names. Never let AI take moderation/economy actions.
```

### 12.2 Resume Prompt (start of every new Kilo task or after a context reset)

```
Resume Track Modest. Read AGENTS.md, then PROGRESS.md and the last 30 lines of DECISIONS.md.
Find the first unticked task card in docs/KILO_MASTER_PLAN.md §7 whose prerequisites are ticked.
Run `git status` and `pnpm lint && pnpm typecheck && pnpm test` to confirm the tree is green; if red, fix that first.
Then execute that task card using the §8 workflow, reading only its listed spec line ranges.
```

### 12.3 Phase Audit Prompt

```
Audit phase <N>. For every checklist ID in this phase: (a) find the implementing code and tests, (b) run the tests,
(c) verify the spec section's "Done when" bullets, (d) confirm i18n, settings and COMMANDS.md entries exist.
Output a table: ID | status (done/partial/missing) | evidence (file or test) | gap. Fix every gap or record a
justified deviation in DECISIONS.md. Do not tick an ID you have not verified. Then run the phase gate from the plan.
```

### 12.4 Blocked Prompt (if two attempts fail)

```
Switch to Debug mode. State the failing command and full error, list 3 hypotheses ranked by likelihood, test the
cheapest first, and change one thing at a time. If still failing after 3 hypotheses, write the blocker and what
you tried to DECISIONS.md, mark the card BLOCKED in PROGRESS.md, and continue with the next independent task.
```

---

## 13. Resources

> Always read the **current** documentation before implementing (spec §44).

### 13.1 Discord
| Resource | URL |
|---|---|
| Developer Portal | https://discord.com/developers/applications |
| Docs start | https://discord.com/developers/docs/intro |
| Application commands | https://discord.com/developers/docs/interactions/application-commands |
| Receiving & responding to interactions | https://discord.com/developers/docs/interactions/receiving-and-responding |
| Message components (incl. Components V2) | https://discord.com/developers/docs/components/overview |
| Gateway & intents | https://discord.com/developers/docs/events/gateway |
| Rate limits | https://discord.com/developers/docs/topics/rate-limits |
| Auto Moderation API | https://discord.com/developers/docs/resources/auto-moderation |
| Audit logs | https://discord.com/developers/docs/resources/audit-log |
| Activities overview | https://discord.com/developers/docs/activities/overview |
| Embedded App SDK (+examples) | https://github.com/discord/embedded-app-sdk |
| Developer Policy | https://discord.com/developers/docs/policies-and-agreements/developer-policy |

### 13.2 Libraries & frameworks
| Library | Use | URL |
|---|---|---|
| discord.js guide | Learning | https://discordjs.guide |
| discord.js docs | API | https://discord.js.org/docs |
| @discordjs/voice | Voice | https://github.com/discordjs/discord.js/tree/main/packages/voice |
| Gemini API | AI | https://ai.google.dev/gemini-api/docs |
| Gemini Live API | Voice AI | https://ai.google.dev/gemini-api/docs/live |
| Gemini rate limits & pricing | Budgets | https://ai.google.dev/gemini-api/docs/rate-limits |
| `@google/genai` SDK | SDK | https://github.com/googleapis/js-genai |
| Google AI Studio | Keys/prompts | https://aistudio.google.com |
| Prisma | ORM | https://www.prisma.io/docs |
| PostgreSQL | DB | https://www.postgresql.org/docs/ |
| Redis | Cache | https://redis.io/docs/latest/ |
| BullMQ | Jobs | https://docs.bullmq.io |
| Zod | Validation | https://zod.dev |
| pino | Logs | https://getpino.io |
| Sentry (Node) | Errors | https://docs.sentry.io/platforms/javascript/guides/node/ |
| i18next | i18n | https://www.i18next.com |
| @napi-rs/canvas | Cards | https://github.com/Brooooooklyn/canvas |
| node-re2 | Safe regex | https://github.com/uhop/node-re2 |
| chrono-node | Date parsing | https://github.com/wanasit/chrono |
| rss-parser | Feeds | https://github.com/rbren/rss-parser |
| chess.js | Chess rules | https://github.com/jhlywa/chess.js |
| simplex-noise | Worldgen | https://github.com/jwagner/simplex-noise.js |
| Phaser 3 | Game client | https://docs.phaser.io |
| Colyseus | Game server | https://docs.colyseus.io |
| Vite | Activity build | https://vite.dev/guide/ |
| Next.js | Dashboard | https://nextjs.org/docs |
| Auth.js | Discord login | https://authjs.dev |
| Tailwind CSS | Styling | https://tailwindcss.com/docs |
| Turborepo | Monorepo | https://turborepo.com/docs |
| pnpm | Packages | https://pnpm.io |
| Vitest | Tests | https://vitest.dev |
| Testcontainers (Node) | Integration tests | https://node.testcontainers.org |
| Docker | Containers | https://docs.docker.com |
| Caddy | HTTPS proxy | https://caddyserver.com/docs/ |
| Kilo Code docs | Agent features (modes, rules, MCP) | https://kilo.ai/docs |

### 13.3 Art, audio & content (log every licence in `apps/activity/ASSETS_LICENSES.md`)
| Resource | Notes | URL |
|---|---|---|
| Kenney | CC0 packs, safe for prototype & release | https://kenney.nl/assets |
| OpenGameArt | Use CC0/CC-BY only; credit authors | https://opengameart.org |
| itch.io free assets | Read each pack's licence | https://itch.io/game-assets/free |
| Freesound | Prefer CC0 | https://freesound.org |
| Google Fonts | Inter, Noto, pixel fonts | https://fonts.google.com |
| Open Trivia DB | CC BY-SA 4.0, **attribution required** | https://opentdb.com |
| dwyl English words | Word games | https://github.com/dwyl/english-words |
| LibreSprite / Piskel / Aseprite | Pixel art | https://github.com/LibreSprite/LibreSprite · https://www.piskelapp.com · https://www.aseprite.org |
| Free Texture Packer | Atlases | https://free-tex-packer.com |
| Tiled | Maps/structures | https://www.mapeditor.org |

**Never** use art, sprites, music, names or text from commercial games. Final art for Nova, bosses, Pet Pals and Card Clash must be original or licensed.

---

## 14. Troubleshooting quick table

| Symptom | Likely cause → fix |
|---|---|
| Slash commands don't appear | Registered globally in dev (slow) → register to `DEV_GUILD_ID`; or registration script not run / hash unchanged |
| "Unknown interaction" / "Interaction already acknowledged" | Missed 3 s window or double reply → `defer` early; use `editReply`/`followUp` after replying |
| "Used disallowed intents" | Enable Server Members + Message Content intents in the portal |
| Bot can't ban/kick/timeout a member | Role hierarchy → move bot role above target; Permission Doctor message should say so |
| V2 message fails to send | Included `content`/`embeds`, missing `IS_COMPONENTS_V2` flag, or too many components |
| Voice connects but no audio received | Bot self-deafened, user not consented (by design), or missing DAVE dependency |
| Voice robotic/fast/slow | Wrong sample rate or channel count in a resampling step |
| BullMQ job never runs | Worker not running / wrong queue name / Redis flushed → boot sweep should re-enqueue |
| Prisma migrate fails | Check `DATABASE_URL`, Docker health, and the installed Prisma major's config requirements |
| Activity shows blank iframe | URL mapping missing/incorrect in portal, tunnel down, CSP/mixed content (needs HTTPS) |
| Players rubber-band in Hollowdeep | Client prediction not reconciling with server input sequence numbers; check tick rate and input buffering |
| Gemini 429/5xx storm | Budget/cooldown too lax → circuit breaker opens; verify friendly fallback |
| Tests flaky | Real timers → use fake timers; shared DB state → isolate per test with Testcontainers |
| Agent loops or drifts | End task, run **Resume Prompt** (§12.2); shrink spec slice; switch to Debug mode (§12.4) |

---

## 15. Coverage matrix (every checklist ID → card)

| Prefix | IDs | Cards |
|---|---|---|
| CORE | 01–14 | T0.1–T0.7, T1.1, T1.4, T1.10, T2.1, lane I |
| CFG | 01–09 | T1.2, T1.3 |
| MOD | 01–13 / 14–16 / 17 / 18 / 19 / 20 | T1.5 / T2.6 / lane A / lane D / T1.9 / lane D |
| AM | 01–11, 14, 15 / 12–13 | T1.6 / lane D |
| SEC | 01–03 / 04 / 05 / 06–10 | T1.7 / T2.7 / T2.2 / lane D |
| LOG | 01–05 | T1.8 |
| SUP | 01–07 / 08 / 09 | lane B / T2.1 / lane E |
| COM | 01–03 / 04 / 05–10 / 11–15 | T2.5 / T2.3 / lane B / lane C |
| REP | 01–06 | T2.2 |
| AI | 01 / 02 / 03–05 / 06 / 07 / 08–09 / 10–14 / 15–16 | T3.1 / T3.2 / T3.3 / T3.4 / T3.5 / lane E / T3.6 / T3.7 |
| VOX | 01 / 02 / 03 / 04 / 05–06 / 07–11 | T5.1 / T5.2 / T5.3 / T5.4 / T5.5 / lane F |
| ECO | 01–04 / 05–09 / 10 | T4.1 / T4.3 / T2.4 |
| GAME | 01 / 02–08 / 09,10,14,15,18,20,22 / 11,12,13,16,17,19 / 21 / 23 / 24 | T4.2 / T4.4 / T4.5 / lane H / T2.8 / lane F / T3.9 |
| HD | 01–07, 09–12, 14, 15, 20–22 / 08, 13 (rest), 16–19 | H1–H12 / lane G |
| PLAT | 01–02 / 03 / 04 / 05–08 | lane A / lane I / T3.8 + lane I / lane I |

**The project is finished when every ID in `PROGRESS.md` is ticked and verified by the Phase Audit Prompt, all tests pass, the release checklist (§11.3) passes on staging, and §39's UI rules hold on every screen.**

*End of Kilo Code Master Build Plan.*
