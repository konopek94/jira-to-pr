import { program } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { runPipeline } from './pipeline.js';

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

program
  .name('jira-to-pr')
  .description('Drive Claude Code headlessly from a Jira issue to a GitHub PR')
  .version('0.1.0')
  .argument('<issue-key>', 'Jira issue key (e.g. PROJ-123)')
  .option('--cwd <path>', 'Repository root (defaults to current directory)', process.cwd())
  .action(async (issueKey: string, options: { cwd: string }) => {
    if (!ISSUE_KEY_RE.test(issueKey)) {
      console.error(`Error: "${issueKey}" is not a valid Jira issue key (expected e.g. PROJ-123)`);
      process.exit(1);
    }

    const repoRoot = resolve(options.cwd);
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      console.error('Copy .env.example to .env and fill in your credentials.');
      process.exit(1);
    }

    try {
      console.log(`Starting pipeline for ${issueKey} in ${repoRoot}`);
      const prUrl = await runPipeline(issueKey, repoRoot, config);
      if (prUrl) {
        console.log(`\nDone! PR created: ${prUrl}`);
      } else {
        console.log('\nDone! Check your GitHub repository for the new PR.');
      }
    } catch (err) {
      console.error(`\nPipeline failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
