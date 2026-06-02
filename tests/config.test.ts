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
