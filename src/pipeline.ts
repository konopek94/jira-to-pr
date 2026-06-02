import { createBranch, commitPlanFile, pushBranch, buildBranchName } from './git.js';
import { runRequirementsPhase } from './phases/requirements.js';
import { runPlanningPhase } from './phases/planning.js';
import { runImplementationPhase } from './phases/implementation.js';
import { runVerificationPhase } from './phases/verification.js';
import { runPullRequestPhase } from './phases/pull-request.js';
import type { Config, PipelineContext } from './types.js';

export async function runPipeline(
  issueKey: string,
  repoRoot: string,
  config: Config
): Promise<string> {
  const requirements = await runRequirementsPhase({ issueKey, repoRoot, config });

  const branchName = buildBranchName(issueKey, requirements.summary);

  const ctx: PipelineContext = {
    issueKey,
    repoRoot,
    config,
    branchName,
  };

  console.log(`[pipeline] Creating branch: ${branchName}`);
  await createBranch(repoRoot, branchName);

  const slices = await runPlanningPhase(ctx, requirements);
  if (slices.length === 0) throw new Error('Planning phase returned no slices');
  await commitPlanFile(repoRoot, issueKey);

  ctx.slices = slices;
  ctx.requirements = requirements;

  await runImplementationPhase(ctx, slices);
  await runVerificationPhase(ctx);

  console.log(`[pipeline] Pushing branch: ${branchName}`);
  await pushBranch(repoRoot, branchName);

  const prUrl = await runPullRequestPhase(ctx, requirements);

  return prUrl;
}
