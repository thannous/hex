# Repository Guidelines

## Project Structure & Module Organization
HEX Ops is a Turborepo monorepo. Customer-facing clients reside in `apps/web` (Next.js 16 App Router) and `apps/mobile` (Expo Router). Shared domain modules are published from `packages/api` (tRPC routers + Zod schemas), `packages/db` (Supabase clients and typed queries), and `packages/business` (pricing logic). Database migrations, edge functions, and seeds live in `supabase/`, while supporting docs and RFCs belong in `docs/`. Respect the layering: apps consume package exports only, and Supabase access flows through `packages/db`.

## Build, Test, and Development Commands
`npm run dev` launches all workspace dev servers except mobile; use `npm run dev:all` to include Expo. `npm run build` and `npm run type-check` must stay green before a PR. Run `npm run lint` and `npm run format` (ESLint + Prettier) before committing. Targeted workspaces run via Turbo filters, e.g., `turbo run dev --filter=@hex/web`. Supabase local services start with `npx supabase start` inside `supabase/`.

- Web E2E (Playwright): `npm run --workspace @hex/web test:e2e`
- Web E2E headed (visible browser): `npm run --workspace @hex/web test:e2e:headed`
- Playwright config lives at `apps/web/playwright.config.ts` and uses friendly defaults: JSON + HTML reporters, globalTimeout, and artifacts (trace on first retry, screenshots/videos on failure). Override base URL with `BASE_URL` if needed.

## Coding Style & Naming Conventions
The repo is TypeScript-first with strict null checks and 2-space indentation. Prefer named exports and colocate UI logic under `app/`, `components/`, or `lib/` folders. React components use PascalCase, files that export hooks use `use-*.ts`, and Tailwind utility classes should favor shadcn/ui tokens. Run `npm run lint` to enforce ESLint rules (Next.js + Expo presets) and `npm run format` for Prettier; skip manual formatting.

## Testing Guidelines
Vitest drives unit tests across packages—name files `*.test.ts` beside the code. Playwright specs in `apps/web/tests/e2e` cover browser flows, and Maestro scripts in `apps/mobile/tests` validate mobile journeys. `npm run test` executes the full matrix; constrain scope with `turbo run test --filter=@hex/business` when iterating. Aim for 80%+ coverage on critical modules and block merges on failing smoke specs. Store fixtures under `tests/fixtures`; never commit Supabase secrets.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style (`fix(mapping): …`, `docs: …`). Choose scopes that mirror workspace folders when possible. Each PR must include a concise summary, linked Linear/Jira issue, screenshots or recordings for UI changes, and notes on schema or Supabase migration impacts. Rebase onto `main`, ensure CI passes (build, type-check, lint, test, Playwright), then request review from the owning team.

## Security & Environment
Never commit `.env*`; copy from `.env.example` and document new keys there. Database changes belong in `supabase/migrations` and must include rollback notes. Validate Supabase RLS policies before shipping multi-tenant features, and rotate service-role keys in CI whenever secrets are regenerated.
