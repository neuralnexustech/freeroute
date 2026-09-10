# Project Agent Rules — Freeroute

## Mandatory Tools

### Context7 (Documentation Lookup)
- **Always** use Context7 to resolve library IDs before writing any code involving external libraries/frameworks.
- Before using any API, SDK, or framework, call `context7_resolve-library-id` then `context7_query-docs` to get the latest documentation.
- Never assume you know the API surface — always verify with Context7, even for well-known libraries.
- When updating dependencies, query Context7 for migration guides and breaking changes.
- **Library IDs for this project**:
  - Next.js: `/vercel/next.js`
  - Prisma: `/prisma/web`
  - Tailwind CSS: `/tailwindlabs/tailwindcss.com`

### Mem0 (Memory & Context Persistence)
- **Always** call `mem0_add_memory` after completing any significant task (bug fix, feature, refactor, architectural decision).
- Store key decisions, gotchas, and project conventions as memories so they persist across sessions.
- Before starting work, search existing memories with `mem0_search_memories` to recall prior context about the codebase.
- Tag memories with relevant metadata (e.g., `module`, `type: decision`, `type: bug`, `type: convention`) for easy retrieval.

## Workflow

1. **Before coding**: Search Mem0 for existing context, then use Context7 to look up relevant docs.
2. **While coding**: Use Context7 as needed for API verification.
3. **After coding**: Store important outcomes/decisions in Mem0.
4. **On errors**: Store debugging insights in Mem0 for future reference.

## Project Context

- **Stack**: Next.js 14 + TypeScript + Tailwind CSS + Prisma + SQLite + Python (freeroute.py)
- **Package manager**: npm
- **Linting/Typecheck**: Run `npm run lint` and `npm run build` after changes
- **Database**: SQLite stored in `~/.freeroute/freeroute.db`
- **Default Port**: 20129 (configurable via `.env`)

## Architecture Overview

### Core Components
- **AI Gateway**: OpenAI-compatible API endpoint at `/v1/chat/completions` and `/v1/models`
- **Combo Router**: Intelligent fallback routing with 5 strategies (failover, round-robin, weighted, latency-based, cost-optimized)
- **Provider System**: Multi-provider support (Groq, Gemini, OpenRouter, NVIDIA, Anthropic, etc.)
- **Dashboard**: Next.js App Router with 9+ pages (Providers, Combos, Models, API Keys, CLI Tools, Activity, Settings, etc.)
- **Playground**: Interactive AI chat with 8 server tools (Web Search, Web Fetch, Image Gen, Datetime, Fusion, Advisor, Subagent, Shell)

### Key Files
- `src/app/api/v1/chat/completions/route.ts` — Main gateway endpoint
- `src/lib/db.ts` — Prisma client with SQLite database setup
- `src/lib/combo.ts` — Combo routing logic
- `src/lib/providers.ts` — Provider definitions and routing
- `src/lib/auth.ts` — API key validation
- `freeroute.py` — Python validation script

### Data Flow
1. Client sends request to `/v1/chat/completions`
2. API key validated via `auth.ts`
3. Model name checked against Combo definitions
4. If Combo → route through tiered fallback system
5. If single model → route to provider directly
6. Request logged to SQLite with telemetry
7. Response streamed back to client

## Coding Conventions

### TypeScript/Next.js
- Use Next.js App Router conventions (route.ts files)
- Export named async functions for HTTP methods (GET, POST, etc.)
- Use `NextRequest` and `NextResponse` from `next/server`
- Keep API routes thin — delegate business logic to `src/lib/*.ts`

### Prisma/Database
- Schema located at `prisma/schema.prisma`
- Use `prisma` client from `@/lib/db`
- SQLite-specific: Avoid relational queries that don't work in SQLite
- Use `$executeRaw` for ALTER TABLE migrations

### Styling
- Tailwind CSS for all styling
- No custom CSS unless absolutely necessary
- Responsive design using Tailwind breakpoints

### Python Scripts
- Standalone validation/benchmark scripts in project root
- Use `urllib.request` for HTTP (no external dependencies)
- Output results to JSON files for analysis

### Designer (`src/app/designer`)
- `src/lib/designerArtifact.ts` owns ALL artifact/fence policy: streaming
  `<artifact>` parser, history extraction (`extractArtifact`,
  `extractFencedArtifact`), display stripping (`stripArtifactTags`,
  `stripFencedCode`). No React imports — pure logic, covered by
  `npm run test:parser` (fixtures in `scripts/fixtures/`).
- `useDesignerChat.ts` is the single owner of chat state (rooms, messages,
  model, streaming, tokens) and the SSE loop; it takes an
  `onArtifactDetected` callback so the page controls panel visibility.
- `page.tsx` is a thin UI shell (~180 lines): layout, empty state, wiring.
- Presentation lives in `components/` (incl. `Composer`); components never
  own chat state. Data flows lib → hook → page → components.

## Common Commands

```bash
# Development
npm run dev          # Start dev server on port 20129

# Build & Lint
npm run build        # Prisma generate + Next.js build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test:parser  # Designer artifact parser regression sweep (chunk sizes 1–4096)

# Database
npx prisma db push   # Push schema to SQLite
npm run db:seed      # Seed database
npx prisma generate  # Generate Prisma client

# Python Validation
python freeroute.py  # Test gateway endpoints
python nvidia_bench.py  # NVIDIA API benchmark
```

## Error Handling Patterns

- Gateway errors return OpenAI-compatible error format: `{ error: { message, type } }`
- Combo failures chain through tiers, returning 502 with full error chain
- Provider connection issues logged to `RequestLog` with error details
- Use `broadcastTelemetry()` for real-time dashboard updates

## Security Notes

- API keys hashed with SHA-256 for validation
- Provider API keys stored in SQLite (not in environment variables)
- Never log or expose API keys in responses
- CORS configured for local development only
