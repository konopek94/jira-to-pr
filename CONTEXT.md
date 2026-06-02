# jira-to-pr — Domain Glossary

## Pipeline

A CLI tool that drives Claude Code headlessly from a Jira issue key to a merged-ready GitHub PR. Invoked as `npx jira-to-pr PROJ-123` from the root of a target repository.

## Session

A single headless Claude Code Agent SDK invocation scoped to one pipeline phase. Multiple sessions run sequentially; each starts fresh. Sessions are configured by the pipeline with MCP server definitions derived from env vars.

## Phase

One discrete unit of pipeline work, executed in its own Session. Phases run in order:

1. **Requirements** — reads the Jira Issue via MCP, extracts structured intent, writes assumptions to the Plan File.
2. **Planning** — reads the codebase and requirements, produces the Plan File with named Slices.
3. **Implementation** — executes one Session per Slice, writing code to the branch.
4. **Verification** — runs test/typecheck commands (from CLAUDE.md or auto-discovered), loops on failure up to the Retry Limit.
5. **PR creation** — opens a GitHub PR via MCP with the branch and plan as context.

## Jira Issue

The unit of work the pipeline reads from Jira via the Atlassian MCP. Identified by a key (e.g. `PROJ-123`). If the issue is too vague, the pipeline proceeds with assumptions explicitly flagged in the Plan File.

## Plan File

A markdown file at `docs/plan-<ISSUE-KEY>.md`, committed to the Implementation Branch. Records requirements, assumptions, and the list of Slices. Serves as the auditable paper trail visible in the PR diff.

## Slice

A vertically deliverable unit of implementation defined in the Plan File. Each Slice is implemented in its own Session during the Implementation Phase.

## Implementation Branch

A git branch created by the pipeline, named `jira/<ISSUE-KEY>-<title-slug>` (e.g. `jira/PROJ-123-add-user-auth`).

## Retry Limit

Maximum number of times the Verification Phase re-runs on failure before the pipeline exits with an error. Fixed at **3**.

## CLAUDE.md / AGENTS.md

A file in the target repository root that Claude Code reads automatically. The pipeline relies on it as the source of truth for test and typecheck commands. Auto-discovery from `package.json` scripts is used as fallback.

## MCP Server

A Model Context Protocol server injected into each Session by the pipeline. Two are used:
- **Atlassian MCP** — Jira read access. Configured from `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` env vars.
- **GitHub MCP** — PR creation. Delegates auth to the `gh` CLI.
