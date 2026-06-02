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
    const missing = result.error.issues
      .map((i) => i.path.join('.') || i.message)
      .join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  return {
    atlassianSiteName: result.data.ATLASSIAN_SITE_NAME,
    atlassianUserEmail: result.data.ATLASSIAN_USER_EMAIL,
    atlassianApiToken: result.data.ATLASSIAN_API_TOKEN,
  };
}
