# Karaoke Picker

[![CI](https://github.com/PaulAugsten/karaoke-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/PaulAugsten/karaoke-picker/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/PaulAugsten/karaoke-picker/branch/main/graph/badge.svg)](https://codecov.io/gh/PaulAugsten/karaoke-picker)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/PaulAugsten/karaoke-picker/badge)](https://scorecard.dev/viewer/?uri=github.com/PaulAugsten/karaoke-picker)



## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in the values, see the table below
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> `pnpm install` also tries to install the [pre-commit](https://pre-commit.com/) git hooks (see
> [.pre-commit-config.yaml](.pre-commit-config.yaml)). If `pre-commit` isn't on your `PATH`
> (`pipx install pre-commit`), the install step prints a warning instead of failing - run
> `pre-commit install -t pre-commit -t commit-msg -t pre-push` yourself afterwards.

## Environment variables

Copy [.env.example](.env.example) to `.env.local` and fill these in. Never commit a real `.env`.

| Variable | Required for | Description |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | client errors | Sentry DSN used by the browser SDK. |
| `SENTRY_DSN` | server errors | Sentry DSN used by the server/edge SDK. |
| `SENTRY_ORG` | build (CI/CD) | Sentry org slug, used to upload source maps and tag releases. |
| `SENTRY_PROJECT` | build (CI/CD) | Sentry project slug. |
| `SENTRY_AUTH_TOKEN` | build (CI/CD) | Sentry auth token for source map upload. Build no-ops without it. |

## Scripts reference

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the Next.js dev server. |
| `pnpm build` | Production build. |
| `pnpm start` | Run the production build. |
| `pnpm analyze` | Production build with the bundle analyzer enabled. |
| `pnpm lint` / `pnpm lint:fix` | Biome check / check-and-fix. |
| `pnpm lint:next` | ESLint (Next.js-specific rules, e.g. Core Web Vitals). |
| `pnpm format` | Biome format, write in place. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests. |
| `pnpm test:coverage` | Vitest with coverage thresholds enforced. |
| `pnpm test:e2e` | Playwright end-to-end + accessibility tests. |
| `pnpm size` | Check bundle size against [.size-limit.json](.size-limit.json) budgets (after `pnpm build`). |
| `pnpm doctor` | Run `react-doctor` against the codebase. |
| `pnpm knip` | Find unused files, exports, and dependencies. |
| `pnpm release:dry-run` | Preview the next semantic-release version/changelog without publishing. |

## Releases

Versioning and `CHANGELOG.md` are automated by [semantic-release](release.config.mjs) from
[Conventional Commits](https://www.conventionalcommits.org/) on every merge to `main` - see the
`release` job in [.github/workflows/ci.yml](.github/workflows/ci.yml).
PRs are squash-merged, so the **PR title** is the commit that counts - it's checked by
[pr-title.yml](.github/workflows/pr-title.yml).

## Repository setup

After creating the GitHub repo and pushing `main`, run `./scripts/setup-github.sh` once (needs
the [GitHub CLI](https://cli.github.com/)). It configures squash-only merging, auto-merge (used by
Renovate), Dependabot alerts (Renovate reads them for security updates; Dependabot's own PRs are
turned off), private vulnerability reporting, secret scanning with push
protection, a read-only default `GITHUB_TOKEN` with SHA-pinned actions required, and a
ruleset on `main` requiring a PR plus every CI check
and a successful Vercel preview deploy, and creates the `RELEASE_DEPLOY_KEY` deploy key that lets semantic-release
push its release commit.

Dependency updates come from a self-hosted [Renovate](.github/renovate.json5)
([workflow](.github/workflows/renovate.yml)): grouped, held back 3 days after release, and
minor/patch updates automerge once CI passes. Automated commits are authored as
`PaulAugsten <58978786+PaulAugsten@users.noreply.github.com>`.

Secrets / variables the workflows use (Settings > Secrets and variables > Actions):

| Name | Kind | Used by |
|---|---|---|
| `CODECOV_TOKEN` | secret | Coverage upload in `ci.yml` (skipped until set). |
| `CI_AUTOMATION_TOKEN` | secret | Renovate. Fine-grained PAT with read and write on Contents, Pull requests, Issues, Workflows and Commit statuses, plus read-only Dependabot alerts. Renovate is skipped until set. |
| `RELEASE_DEPLOY_KEY` | secret | semantic-release push to `main` (created by `setup-github.sh`). |
| `RELEASE_TOKEN` | secret | Optional PAT for semantic-release's GitHub API calls, so the release it creates can trigger workflows. Falls back to `GITHUB_TOKEN`. |
| `GITLEAKS_LICENSE` | secret | Only for repos owned by an organization. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | secret | Source map upload during `build`. |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | secret | Production deploy job (`production` environment). |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | secret | E2E + Lighthouse against protected preview deploys. |
| `PRODUCTION_URL` | variable | Hourly uptime smoke test (`uptime.yml`, skipped until set). |
