# jira-to-pr

Drive Claude Code headlessly from a Jira issue to a reviewed GitHub PR.

```
npx jira-to-pr PROJ-123
```

## What it does

Given a Jira issue key, the pipeline:

1. **Fetches requirements** from Jira via MCP and extracts structured intent (summary, acceptance criteria, assumptions)
2. **Writes a plan** by analyzing the target codebase and producing `docs/plan-<KEY>.md` with named implementation slices
3. **Implements each slice** in its own Claude Code session, committing as it goes
4. **Verifies** by running the repo's test and typecheck commands — retries up to 3 times on failure
5. **Opens a PR** on GitHub with the branch and plan file as context

Each phase runs as a separate headless Agent SDK session scoped to that one task.

## Prerequisites

- Node.js 20+
- Claude Code CLI authenticated (`claude --version` works)
- `gh` CLI authenticated (`gh auth status` works)
- Atlassian API token

## Setup

```bash
cp .env.example .env
```

Fill in `.env`:

```
ATLASSIAN_SITE_NAME=your-company        # e.g. myorg (not the full URL)
ATLASSIAN_USER_EMAIL=you@company.com
ATLASSIAN_API_TOKEN=your_api_token
```

Get your Atlassian API token at: https://id.atlassian.com/manage-profile/security/api-tokens

## Usage

Run from the root of the repository you want to modify:

```bash
npx jira-to-pr PROJ-123
```

Or point it at a different repo:

```bash
npx jira-to-pr PROJ-123 --cwd /path/to/your/repo
```

The pipeline creates a branch named `jira/PROJ-123-<title-slug>`, commits all changes there, and opens a PR.

## Options

```
Usage: jira-to-pr [options] <issue-key>

Arguments:
  issue-key      Jira issue key (e.g. PROJ-123)

Options:
  -V, --version  output the version number
  --cwd <path>   Repository root (defaults to current directory)
  -h, --help     display help for command
```

## How the pipeline works

```
PROJ-123
   │
   ▼
[Phase 1: Requirements]
   Jira MCP → structured requirements + assumptions
   │
   ▼
[Phase 2: Planning]
   Codebase analysis → docs/plan-PROJ-123.md + slice list
   Branch created: jira/PROJ-123-<slug>
   │
   ▼
[Phase 3: Implementation]
   One Agent SDK session per slice → commits
   │
   ▼
[Phase 4: Verification]
   Runs tests + typecheck → fixes on failure (up to 3 attempts)
   Branch pushed to origin
   │
   ▼
[Phase 5: PR creation]
   gh pr create → PR URL
```

The plan file (`docs/plan-PROJ-123.md`) is committed to the branch and becomes part of the PR diff — an auditable record of what was intended and why.

## Target repo conventions

The pipeline respects `CLAUDE.md` or `AGENTS.md` at the repo root for:
- Test command
- Typecheck command
- Any coding conventions Claude should follow

If neither file exists, the pipeline falls back to `package.json` scripts (`test`, `typecheck`, `lint`).

## Development

```bash
npm install
npm test          # run unit tests
npm run build     # compile TypeScript to dist/
npm run dev       # run via tsx (no build needed)
```

## License

MIT
