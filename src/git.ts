import simpleGit from 'simple-git';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildBranchName(issueKey: string, title: string): string {
  const slug = slugify(title).slice(0, 40);
  return `jira/${issueKey}-${slug}`;
}

export async function createBranch(repoRoot: string, branchName: string): Promise<void> {
  const git = simpleGit(repoRoot);
  await git.checkoutLocalBranch(branchName);
}

export async function pushBranch(repoRoot: string, branchName: string): Promise<void> {
  const git = simpleGit(repoRoot);
  await git.push(['--set-upstream', 'origin', branchName]);
}

export async function commitPlanFile(repoRoot: string, issueKey: string): Promise<void> {
  const git = simpleGit(repoRoot);
  await git.add(`docs/plan-${issueKey}.md`);
  await git.commit(`docs(plan): add plan for ${issueKey}`);
}
