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
        throw new Error(`Planning phase failed: ${(message as any).errors?.join(', ')}`);
      }
      const output = (message as any).structured_output as PlanningOutput;
      return output.slices;
    }
  }

  throw new Error('Planning phase produced no result');
}
