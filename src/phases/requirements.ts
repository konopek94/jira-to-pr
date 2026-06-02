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
        throw new Error(`Requirements phase failed: ${(message as any).errors?.join(', ')}`);
      }
      return (message as any).structured_output as Requirements;
    }
  }

  throw new Error('Requirements phase produced no result');
}
