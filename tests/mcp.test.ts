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
