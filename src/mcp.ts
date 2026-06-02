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
      ...(process.env as Record<string, string>),
      ATLASSIAN_SITE_NAME: config.atlassianSiteName,
      ATLASSIAN_USER_EMAIL: config.atlassianUserEmail,
      ATLASSIAN_API_TOKEN: config.atlassianApiToken,
    },
  };
}
