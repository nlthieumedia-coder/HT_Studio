# HT_Dola_Studio

HT_Dola_Studio is a local Windows desktop production manager for managing video-generation workflows through authorized browser sessions.

## Monorepo Architecture

```
/
├─ apps/
│  ├─ desktop/              # Tauri v2 + React UI shell
│  └─ automation-service/    # Fastify backend service with SQLite & Playwright
├─ packages/
│  ├─ shared/               # Shared TS types, Zod schemas, job states, provider contracts
│  └─ ui/                   # Design system & shared components
├─ data/                    # Local storage for DB, profiles, downloads, and logs
├─ docs/                    # Technical architecture & phase status docs
└─ pnpm-workspace.yaml
```

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm dev:desktop` - Start desktop UI application
- `pnpm dev:service` - Start local automation backend service
- `pnpm build` - Build all packages and applications
- `pnpm typecheck` - Run TypeScript typechecks across the monorepo
- `pnpm lint` - Run ESLint across all codebases
