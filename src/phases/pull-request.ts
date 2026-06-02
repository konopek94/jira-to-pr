import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultError, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';
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
2. Write the PR title to a temp file: printf '%s' '${ctx.issueKey}: ${requirements.summary.replace(/'/g, "'\\''")}' > /tmp/pr-title.txt
3. Run: gh pr create --title "$(cat /tmp/pr-title.txt)" --body-file docs/plan-${ctx.issueKey}.md
4. Output the PR URL on the last line of your response, prefixed with "PR_URL: ".

The gh CLI is already authenticated. Use it directly.
    `.trim(),
    options: {
      cwd: ctx.repoRoot,
      allowedTools: ['Read', 'Bash'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      settingSources: ['project'],
      strictMcpConfig: true,
      maxTurns: 10,
    },
  });

  for await (const message of session) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`PR creation failed: ${(message as SDKResultError).errors.join(', ')}`);
      }
      const match = (message as SDKResultSuccess).result.match(/PR_URL: (https:\/\/github\.com\/\S+)/);
      if (match) prUrl = match[1];
    }
  }

  return prUrl;
}
