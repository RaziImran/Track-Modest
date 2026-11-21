# Track Modest

All-in-one Discord bot platform with moderation, community tools, AI companion (Nova),
games including Hollowdeep, and a web dashboard.

## Stack

TypeScript strict · Node Active LTS · pnpm + Turborepo · discord.js v14 · PostgreSQL 16 +
Prisma · Redis 7 + BullMQ · @google/genai · Zod · pino · Sentry · i18next · Vitest ·
Next.js + Auth.js + Tailwind · Phaser 3 + Colyseus · @napi-rs/canvas · Docker Compose.

## Prerequisites

- Node.js Active LTS (22.x or 24.x)
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker Desktop
- Git
- FFmpeg

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + Redis (dev only)
docker compose -f docker/docker-compose.dev.yml up -d

# 3. Copy env and fill in values
cp .env.example .env
# Edit .env with your Discord token, Gemini API key, etc.

# 4. Run database migrations
pnpm --filter @modest/db prisma migrate dev

# 5. Register slash commands to your dev guild
pnpm --filter @modest/bot register-commands

# 6. Start all apps in watch mode
pnpm dev
```

## Project structure

See `docs/BOT_DESIGN_SPEC.md` §4 (Repository structure) and `docs/KILO_CODE_MASTER_PLAN.md`.

## Rules

Read `AGENTS.md` before contributing. Every feature follows the task card workflow in
`docs/KILO_CODE_MASTER_PLAN.md` §8.
