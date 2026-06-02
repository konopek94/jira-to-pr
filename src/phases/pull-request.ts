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
        throw new Error(`PR creation failed: ${(message as any).errors?.join(', ')}`);
      }
      const match = (message as any).result.match(/PR_URL: (https:\/\/github\.com\/\S+)/);
      if (match) prUrl = match[1];
    }
  }

  return prUrl;
}
