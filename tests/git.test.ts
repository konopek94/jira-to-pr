import { describe, it, expect } from 'vitest';
import { slugify, buildBranchName } from '../src/git.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Add User Authentication')).toBe('add-user-authentication');
  });

  it('strips special characters', () => {
    expect(slugify('Fix: login bug (critical!)')).toBe('fix-login-bug-critical');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });
});

describe('buildBranchName', () => {
  it('returns jira/<key>-<slug>', () => {
    expect(buildBranchName('PROJ-123', 'Add user auth')).toBe(
      'jira/PROJ-123-add-user-auth'
    );
  });

  it('truncates slug to 40 chars', () => {
    const long = 'a'.repeat(60);
    const name = buildBranchName('PROJ-1', long);
    expect(name).toBe(`jira/PROJ-1-${'a'.repeat(40)}`);
  });
});
