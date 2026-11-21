# Track Modest — Agent Rules (read every task)

## Source of truth
- Spec: docs/BOT_DESIGN_SPEC.md. Plan: docs/KILO_CODE_MASTER_PLAN.md. Checklist: PROGRESS.md.
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
- pnpm lint && pnpm typecheck && pnpm test all green.
- i18n strings added; settings added to config schema + /settings category.
- Every "Done when" bullet of the section checked.
- PROGRESS.md IDs ticked with commit hash; DECISIONS.md updated; one conventional commit per task.

## Behaviour
- Prefer small commits: feat(mod): ..., fix(automod): ..., test(rep): ... .
- Do not refactor unrelated code. Do not add dependencies without need; record each in DECISIONS.md.
- When docs may have changed (discord.js, Prisma, Gemini, Discord limits), check current docs before coding.
- If blocked >2 failed attempts: switch to Debug mode; if still blocked, write the blocker in DECISIONS.md and move to the next independent task.
