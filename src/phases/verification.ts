import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';
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
      lastResult = (message as SDKResultSuccess).result;
    }
  }

  return lastResult.includes('VERIFICATION_PASSED');
}
