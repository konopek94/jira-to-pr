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
          `Implementation failed on slice "${slice.name}": ${(message as any).errors?.join(', ')}`
        );
      }
    }
  }
}
