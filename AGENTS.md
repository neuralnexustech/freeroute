# Project Agent Rules — Freeroute

## Mandatory Tools

### Context7 (Documentation Lookup)
- **Always** use Context7 to resolve library IDs before writing any code involving external libraries/frameworks.
- Before using any API, SDK, or framework, call `context7_resolve-library-id` then `context7_query-docs` to get the latest documentation.
- Never assume you know the API surface — always verify with Context7, even for well-known libraries.
- When updating dependencies, query Context7 for migration guides and breaking changes.

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

- **Stack**: Next.js + TypeScript + Tailwind CSS + Prisma + Python (freeroute.py)
- **Package manager**: npm
- **Linting/Typecheck**: Run `npm run lint` and `npm run build` after changes
