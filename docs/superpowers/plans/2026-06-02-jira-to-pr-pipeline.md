# jira-to-pr Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source CLI tool (`npx jira-to-pr PROJ-123`) that drives Claude Code headlessly via the Agent SDK through five phases — requirements extraction, planning, per-slice implementation, verification with retry, and PR creation.

**Architecture:** Five sequential Agent SDK sessions, each scoped to one phase. The Jira MCP server is injected programmatically from env vars; GitHub operations go through `gh` CLI via Bash. Each session runs with `permissionMode: 'bypassPermissions'` so there are no interactive prompts. Phases share a `PipelineContext` object threaded through by the pipeline orchestrator.

**Tech Stack:** TypeScript, Node.js 20+, `@anthropic-ai/claude-agent-sdk`, `@aashari/mcp-server-atlassian-jira`, `commander`, `simple-git`, `zod`, `vitest`

---

## File Map

```
src/
  index.ts            CLI entry (commander, validates issue key, runs pipeline)
  config.ts           Env var loading and validation (zod)
  mcp.ts              MCP server config builder for Jira
  git.ts              Branch creation and slugify utility
  pipeline.ts         Phases orchestration + PipelineContext
  types.ts            Shared types (Config, Requirements, Slice, PipelineContext)
  phases/
    requirements.ts   Phase 1: Jira → structured Requirements via SDK
    planning.ts       Phase 2: codebase analysis → plan file + slice list via SDK
    implementation.ts Phase 3: per-slice implementation loop via SDK
    verification.ts   Phase 4: test/typecheck with up to 3 retries via SDK
    pull-request.ts   Phase 5: gh pr create via SDK Bash
tests/
  config.test.ts
  git.test.ts
  mcp.test.ts
```

---

## Task 1: Project initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "jira-to-pr",
  "version": "0.1.0",
  "description": "Drive Claude Code headlessly from a Jira issue to a reviewed GitHub PR",
  "bin": {
    "jira-to-pr": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["claude", "jira", "github", "ai", "automation", "mcp"],
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.160",
    "@aashari/mcp-server-atlassian-jira": "^3.3.0",
    "commander": "^14.0.2",
    "simple-git": "^3.27.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create .env.example**

```
ATLASSIAN_SITE_NAME=your-company
ATLASSIAN_USER_EMAIL=your.email@company.com
ATLASSIAN_API_TOKEN=your_api_token
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.tgz
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .env.example .gitignore CONTEXT.md
git commit -m "chore: initialize jira-to-pr project"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
export type Config = {
  atlassianSiteName: string;
  atlassianUserEmail: string;
  atlassianApiToken: string;
};

export type Requirements = {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  assumptions: string[];
};

export type Slice = {
  name: string;
  description: string;
};

export type PipelineContext = {
  issueKey: string;
  repoRoot: string;
  config: Config;
  branchName: string;
  requirements?: Requirements;
  slices?: Slice[];
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add shared pipeline types"
```

---

## Task 3: Config module

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/config.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const required = {
    ATLASSIAN_SITE_NAME: 'mycompany',
    ATLASSIAN_USER_EMAIL: 'dev@mycompany.com',
    ATLASSIAN_API_TOKEN: 'token123',
  };

  afterEach(() => {
    delete process.env.ATLASSIAN_SITE_NAME;
    delete process.env.ATLASSIAN_USER_EMAIL;
    delete process.env.ATLASSIAN_API_TOKEN;
  });

  it('returns config when all env vars are set', () => {
    Object.assign(process.env, required);
    const config = loadConfig();
    expect(config).toEqual({
      atlassianSiteName: 'mycompany',
      atlassianUserEmail: 'dev@mycompany.com',
      atlassianApiToken: 'token123',
    });
  });

  it('throws when ATLASSIAN_SITE_NAME is missing', () => {
    Object.assign(process.env, required);
    delete process.env.ATLASSIAN_SITE_NAME;
    expect(() => loadConfig()).toThrow('ATLASSIAN_SITE_NAME');
  });

  it('throws when ATLASSIAN_USER_EMAIL is missing', () => {
    Object.assign(process.env, required);
    delete process.env.ATLASSIAN_USER_EMAIL;
    expect(() => loadConfig()).toThrow('ATLASSIAN_USER_EMAIL');
  });

  it('throws when ATLASSIAN_API_TOKEN is missing', () => {
    Object.assign(process.env, required);
    delete process.env.ATLASSIAN_API_TOKEN;
    expect(() => loadConfig()).toThrow('ATLASSIAN_API_TOKEN');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — "Cannot find module '../src/config.js'"

- [ ] **Step 3: Write config.ts**

```typescript
// src/config.ts
import { z } from 'zod';
import type { Config } from './types.js';

const schema = z.object({
  ATLASSIAN_SITE_NAME: z.string().min(1, 'ATLASSIAN_SITE_NAME is required'),
  ATLASSIAN_USER_EMAIL: z.string().min(1, 'ATLASSIAN_USER_EMAIL is required'),
  ATLASSIAN_API_TOKEN: z.string().min(1, 'ATLASSIAN_API_TOKEN is required'),
});

export function loadConfig(): Config {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.message).join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  return {
    atlassianSiteName: result.data.ATLASSIAN_SITE_NAME,
    atlassianUserEmail: result.data.ATLASSIAN_USER_EMAIL,
    atlassianApiToken: result.data.ATLASSIAN_API_TOKEN,
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(config): add env var validation"
```

---

## Task 4: MCP config module

**Files:**
- Create: `src/mcp.ts`
- Create: `tests/mcp.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/mcp.test.ts
import { describe, it, expect } from 'vitest';
import { buildJiraMcpConfig } from '../src/mcp.js';
import type { Config } from '../src/types.js';

describe('buildJiraMcpConfig', () => {
  const config: Config = {
    atlassianSiteName: 'mycompany',
    atlassianUserEmail: 'dev@mycompany.com',
    atlassianApiToken: 'secret',
  };

  it('returns a stdio MCP config for the Jira server', () => {
    const mcpConfig = buildJiraMcpConfig(config);
    expect(mcpConfig.command).toBe('npx');
    expect(mcpConfig.args).toContain('@aashari/mcp-server-atlassian-jira');
    expect(mcpConfig.env?.ATLASSIAN_SITE_NAME).toBe('mycompany');
    expect(mcpConfig.env?.ATLASSIAN_USER_EMAIL).toBe('dev@mycompany.com');
    expect(mcpConfig.env?.ATLASSIAN_API_TOKEN).toBe('secret');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — "Cannot find module '../src/mcp.js'"

- [ ] **Step 3: Write mcp.ts**

```typescript
// src/mcp.ts
import type { Config } from './types.js';

type StdioMcpConfig = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export function buildJiraMcpConfig(config: Config): StdioMcpConfig {
  return {
    command: 'npx',
    args: ['-y', '@aashari/mcp-server-atlassian-jira'],
    env: {
      ...process.env as Record<string, string>,
      ATLASSIAN_SITE_NAME: config.atlassianSiteName,
      ATLASSIAN_USER_EMAIL: config.atlassianUserEmail,
      ATLASSIAN_API_TOKEN: config.atlassianApiToken,
    },
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp.ts tests/mcp.test.ts
git commit -m "feat(mcp): add Jira MCP server config builder"
```

---

## Task 5: Git module

**Files:**
- Create: `src/git.ts`
- Create: `tests/git.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/git.test.ts
import { describe, it, expect } from 'vitest';
import { slugify, buildBranchName } from '../src/git.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Add User Authentication')).toBe('add-user-authentication');
  });

  it('strips special characters', () => {
    expect(slugify('Fix: login bug (critical!)')).toBe('fix-login-bug-critical');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });
});

describe('buildBranchName', () => {
  it('returns jira/<key>-<slug>', () => {
    expect(buildBranchName('PROJ-123', 'Add user auth')).toBe(
      'jira/PROJ-123-add-user-auth'
    );
  });

  it('truncates slug to 40 chars', () => {
    const long = 'a'.repeat(60);
    const name = buildBranchName('PROJ-1', long);
    expect(name).toBe(`jira/PROJ-1-${'a'.repeat(40)}`);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test`
Expected: FAIL — "Cannot find module '../src/git.js'"

- [ ] **Step 3: Write git.ts**

```typescript
// src/git.ts
import simpleGit from 'simple-git';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildBranchName(issueKey: string, title: string): string {
  const slug = slugify(title).slice(0, 40);
  return `jira/${issueKey}-${slug}`;
}

export async function createBranch(repoRoot: string, branchName: string): Promise<void> {
  const git = simpleGit(repoRoot);
  await git.checkoutLocalBranch(branchName);
}

export async function commitPlanFile(repoRoot: string, issueKey: string): Promise<void> {
  const git = simpleGit(repoRoot);
  await git.add(`docs/plan-${issueKey}.md`);
  await git.commit(`docs(plan): add plan for ${issueKey}`);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test`
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/git.ts tests/git.test.ts
git commit -m "feat(git): add branch naming and slugify utilities"
```

---

## Task 6: Phase 1 — Requirements extraction

**Files:**
- Create: `src/phases/requirements.ts`

- [ ] **Step 1: Write requirements.ts**

```typescript
// src/phases/requirements.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { PipelineContext, Requirements } from '../types.js';
import { buildJiraMcpConfig } from '../mcp.js';

export async function runRequirementsPhase(ctx: PipelineContext): Promise<Requirements> {
  console.log(`[requirements] Fetching ${ctx.issueKey} from Jira...`);

  const jiraMcp = buildJiraMcpConfig(ctx.config);

  const session = query({
    prompt: `
Fetch the Jira issue ${ctx.issueKey} using the jira_get tool.
The endpoint is: /rest/api/3/issue/${ctx.issueKey}

Extract and return as structured output:
- summary: the issue title
- description: the full issue description (plain text, no markup)
- acceptanceCriteria: list of acceptance criteria (from description or custom fields, or [] if none found)
- assumptions: list of any ambiguities or gaps you notice that are not explicitly stated in the issue (things the implementer will need to assume)

If the issue is very vague, still proceed and list what you understood as assumptions.
    `.trim(),
    options: {
      mcpServers: { jira: jiraMcp },
      allowedTools: ['mcp__jira__jira_get'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      strictMcpConfig: true,
      maxTurns: 10,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            description: { type: 'string' },
            acceptanceCriteria: { type: 'array', items: { type: 'string' } },
            assumptions: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'description', 'acceptanceCriteria', 'assumptions'],
        },
      },
    },
  });

  for await (const message of session) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`Requirements phase failed: ${message.errors?.join(', ')}`);
      }
      return message.structured_output as Requirements;
    }
  }

  throw new Error('Requirements phase produced no result');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/phases/requirements.ts
git commit -m "feat(phases): add requirements extraction phase"
```

---

## Task 7: Phase 2 — Planning

**Files:**
- Create: `src/phases/planning.ts`

- [ ] **Step 1: Write planning.ts**

```typescript
// src/phases/planning.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PipelineContext, Requirements, Slice } from '../types.js';

type PlanningOutput = {
  slices: Slice[];
};

export async function runPlanningPhase(
  ctx: PipelineContext,
  requirements: Requirements
): Promise<Slice[]> {
  console.log(`[planning] Analyzing codebase and writing plan...`);

  const planPath = `docs/plan-${ctx.issueKey}.md`;
  mkdirSync(join(ctx.repoRoot, 'docs'), { recursive: true });

  const session = query({
    prompt: `
You are planning the implementation of Jira issue ${ctx.issueKey}.

## Requirements
**Summary:** ${requirements.summary}

**Description:**
${requirements.description}

**Acceptance Criteria:**
${requirements.acceptanceCriteria.map((c) => `- ${c}`).join('\n') || '(none specified)'}

**Assumptions made:**
${requirements.assumptions.map((a) => `- ${a}`).join('\n') || '(none)'}

## Your task
1. Explore the codebase to understand the relevant code areas.
2. Write a plan to ${planPath} in this exact format:

\`\`\`markdown
# Plan: ${ctx.issueKey} — ${requirements.summary}

## Assumptions
<list any assumptions or gaps from the requirements>

## Slices
### Slice 1: <name>
<what this slice delivers>

### Slice 2: <name>
<what this slice delivers>

(add as many slices as needed for a complete implementation)
\`\`\`

3. Return as structured output the list of slices with name and description.

Keep slices small and independently testable. Aim for 2-5 slices for most tasks.
    `.trim(),
    options: {
      cwd: ctx.repoRoot,
      allowedTools: ['Read', 'Write', 'Glob', 'Bash', 'Grep'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      settingSources: ['project'],
      strictMcpConfig: true,
      maxTurns: 30,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            slices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
          required: ['slices'],
        },
      },
    },
  });

  for await (const message of session) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`Planning phase failed: ${message.errors?.join(', ')}`);
      }
      const output = message.structured_output as PlanningOutput;
      return output.slices;
    }
  }

  throw new Error('Planning phase produced no result');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/phases/planning.ts
git commit -m "feat(phases): add planning phase"
```

---

## Task 8: Phase 3 — Implementation

**Files:**
- Create: `src/phases/implementation.ts`

- [ ] **Step 1: Write implementation.ts**

```typescript
// src/phases/implementation.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { PipelineContext, Slice } from '../types.js';

export async function runImplementationPhase(
  ctx: PipelineContext,
  slices: Slice[]
): Promise<void> {
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    console.log(`[implementation] Slice ${i + 1}/${slices.length}: ${slice.name}`);

    const session = query({
      prompt: `
You are implementing slice ${i + 1} of ${slices.length} for Jira issue ${ctx.issueKey}.

**Slice:** ${slice.name}
**Goal:** ${slice.description}

**Context:**
- The full plan is at docs/plan-${ctx.issueKey}.md — read it first.
- Follow all conventions in CLAUDE.md or AGENTS.md if present.
- Write clean, production-quality code. No TODOs, no placeholders.
- Commit your changes when the slice is complete with: git commit -m "feat(${ctx.issueKey}): implement ${slice.name}"

Implement this slice now.
      `.trim(),
      options: {
        cwd: ctx.repoRoot,
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Bash', 'Grep'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: ['project'],
        strictMcpConfig: true,
        maxTurns: 50,
      },
    });

    for await (const message of session) {
      if (message.type === 'result' && message.subtype !== 'success') {
        throw new Error(
          `Implementation failed on slice "${slice.name}": ${message.errors?.join(', ')}`
        );
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/phases/implementation.ts
git commit -m "feat(phases): add implementation phase"
```

---

## Task 9: Phase 4 — Verification

**Files:**
- Create: `src/phases/verification.ts`

- [ ] **Step 1: Write verification.ts**

```typescript
// src/phases/verification.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { PipelineContext } from '../types.js';

const RETRY_LIMIT = 3;

export async function runVerificationPhase(ctx: PipelineContext): Promise<void> {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    console.log(`[verification] Attempt ${attempt}/${RETRY_LIMIT}...`);

    const passed = await runVerificationSession(ctx, attempt);
    if (passed) {
      console.log('[verification] All checks passed.');
      return;
    }

    if (attempt === RETRY_LIMIT) {
      throw new Error(
        `Verification failed after ${RETRY_LIMIT} attempts. Fix the issues manually and re-run.`
      );
    }

    console.log(`[verification] Attempt ${attempt} failed. Retrying...`);
  }
}

async function runVerificationSession(ctx: PipelineContext, attempt: number): Promise<boolean> {
  const session = query({
    prompt: `
You are verifying the implementation of Jira issue ${ctx.issueKey} (attempt ${attempt}/${RETRY_LIMIT}).

Your task:
1. Check CLAUDE.md or AGENTS.md for the test and typecheck commands. If not found, look at package.json scripts for "test", "typecheck", or "lint" keys.
2. Run the test command.
3. Run the typecheck command.
4. If any command fails, fix the root cause in the code (do not modify tests to make them pass artificially).
5. Re-run the failing command to confirm the fix.
6. Repeat until all commands pass or you cannot fix the issue.

If all commands pass, output "VERIFICATION_PASSED" as your final message.
If you cannot fix the failures, output "VERIFICATION_FAILED: <reason>".
    `.trim(),
    options: {
      cwd: ctx.repoRoot,
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Bash', 'Grep'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      settingSources: ['project'],
      strictMcpConfig: true,
      maxTurns: 40,
    },
  });

  let lastResult = '';
  for await (const message of session) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        return false;
      }
      lastResult = message.result;
    }
  }

  return lastResult.includes('VERIFICATION_PASSED');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/phases/verification.ts
git commit -m "feat(phases): add verification phase with 3-attempt retry"
```

---

## Task 10: Phase 5 — PR creation

**Files:**
- Create: `src/phases/pull-request.ts`

- [ ] **Step 1: Write pull-request.ts**

```typescript
// src/phases/pull-request.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { PipelineContext, Requirements } from '../types.js';

export async function runPullRequestPhase(
  ctx: PipelineContext,
  requirements: Requirements
): Promise<string> {
  console.log('[pull-request] Creating PR...');

  let prUrl = '';

  const session = query({
    prompt: `
Create a GitHub pull request for Jira issue ${ctx.issueKey}.

**Branch:** ${ctx.branchName}
**Issue summary:** ${requirements.summary}
**Plan file:** docs/plan-${ctx.issueKey}.md

Steps:
1. Read docs/plan-${ctx.issueKey}.md to understand what was implemented.
2. Run: gh pr create --title "${ctx.issueKey}: ${requirements.summary}" --body "$(cat docs/plan-${ctx.issueKey}.md)"
3. Output the PR URL on the last line of your response, prefixed with "PR_URL: ".

The gh CLI is already authenticated. Use it directly.
    `.trim(),
    options: {
      cwd: ctx.repoRoot,
      allowedTools: ['Read', 'Bash'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      strictMcpConfig: true,
      maxTurns: 10,
    },
  });

  for await (const message of session) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`PR creation failed: ${message.errors?.join(', ')}`);
      }
      const match = message.result.match(/PR_URL: (https:\/\/github\.com\/\S+)/);
      if (match) prUrl = match[1];
    }
  }

  return prUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/phases/pull-request.ts
git commit -m "feat(phases): add PR creation phase"
```

---

## Task 11: Pipeline orchestrator

**Files:**
- Create: `src/pipeline.ts`

- [ ] **Step 1: Write pipeline.ts**

```typescript
// src/pipeline.ts
import { createBranch, commitPlanFile, buildBranchName } from './git.js';
import { runRequirementsPhase } from './phases/requirements.js';
import { runPlanningPhase } from './phases/planning.js';
import { runImplementationPhase } from './phases/implementation.js';
import { runVerificationPhase } from './phases/verification.js';
import { runPullRequestPhase } from './phases/pull-request.js';
import type { Config, PipelineContext } from './types.js';

export async function runPipeline(
  issueKey: string,
  repoRoot: string,
  config: Config
): Promise<string> {
  // Phase 1: Extract requirements (before branch creation so we have the title)
  const requirements = await runRequirementsPhase({
    issueKey,
    repoRoot,
    config,
    branchName: '',
  });

  const branchName = buildBranchName(issueKey, requirements.summary);

  const ctx: PipelineContext = {
    issueKey,
    repoRoot,
    config,
    branchName,
  };

  // Create branch
  console.log(`[pipeline] Creating branch: ${branchName}`);
  await createBranch(repoRoot, branchName);

  // Phase 2: Plan
  const slices = await runPlanningPhase(ctx, requirements);
  await commitPlanFile(repoRoot, issueKey);

  ctx.slices = slices;
  ctx.requirements = requirements;

  // Phase 3: Implement each slice
  await runImplementationPhase(ctx, slices);

  // Phase 4: Verify
  await runVerificationPhase(ctx);

  // Phase 5: Open PR
  const prUrl = await runPullRequestPhase(ctx, requirements);

  return prUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pipeline.ts
git commit -m "feat(pipeline): add phase orchestration"
```

---

## Task 12: CLI entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write index.ts**

```typescript
// src/index.ts
import { program } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { runPipeline } from './pipeline.js';

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

program
  .name('jira-to-pr')
  .description('Drive Claude Code headlessly from a Jira issue to a GitHub PR')
  .version('0.1.0')
  .argument('<issue-key>', 'Jira issue key (e.g. PROJ-123)')
  .option('--cwd <path>', 'Repository root (defaults to current directory)', process.cwd())
  .action(async (issueKey: string, options: { cwd: string }) => {
    if (!ISSUE_KEY_RE.test(issueKey)) {
      console.error(`Error: "${issueKey}" is not a valid Jira issue key (expected e.g. PROJ-123)`);
      process.exit(1);
    }

    const repoRoot = resolve(options.cwd);
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      console.error('Copy .env.example to .env and fill in your credentials.');
      process.exit(1);
    }

    try {
      console.log(`Starting pipeline for ${issueKey} in ${repoRoot}`);
      const prUrl = await runPipeline(issueKey, repoRoot, config);
      if (prUrl) {
        console.log(`\nDone! PR created: ${prUrl}`);
      } else {
        console.log('\nDone! Check your GitHub repository for the new PR.');
      }
    } catch (err) {
      console.error(`\nPipeline failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 2: Run test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — all tests still pass

- [ ] **Step 3: Verify CLI help works**

Run: `npx tsx src/index.ts --help`
Expected output includes:
```
Usage: jira-to-pr [options] <issue-key>
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): add commander entry point"
```

---

## Task 13: Build and smoke test

**Files:**
- No new files

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 2: Verify built binary works**

Run: `node dist/index.js --help`
Expected: prints usage without errors.

- [ ] **Step 3: Verify issue key validation**

Run: `node dist/index.js invalid-key`
Expected: `Error: "invalid-key" is not a valid Jira issue key`

- [ ] **Step 4: Final commit**

```bash
git add dist/ -f  # or add dist to .gitignore if publishing via npm
git commit -m "chore: add initial build output"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| `npx jira-to-pr PROJ-123` CLI | Task 12 |
| Jira MCP via `@aashari/mcp-server-atlassian-jira` | Tasks 4, 6 |
| GitHub via `gh` CLI Bash | Task 10 |
| Multiple sequential SDK sessions per phase | Tasks 6-10 |
| Plan file at `docs/plan-PROJ-123.md` | Task 7 |
| Branch naming `jira/PROJ-123-slug` | Task 5 |
| 3-attempt verification retry | Task 9 |
| Env var auth (ATLASSIAN_*) | Task 3 |
| Pipeline spawns MCP servers directly | Task 4 |
| CLAUDE.md/AGENTS.md honored in target repo | Tasks 8, 9 (`settingSources: ['project']`) |
| Proceeds with assumptions if issue is vague | Task 6 (assumptions in prompt + structured output) |

### Placeholder scan
No TBD, TODO, "similar to", or "fill in later" found.

### Type consistency
- `Requirements` defined in `types.ts`, used in `requirements.ts`, `planning.ts`, `pull-request.ts`, `pipeline.ts` ✓
- `Slice` defined in `types.ts`, used in `planning.ts`, `implementation.ts`, `pipeline.ts` ✓
- `PipelineContext` passed through all phases ✓
- `buildJiraMcpConfig` returns same type accepted by `mcpServers` in `Options` ✓
