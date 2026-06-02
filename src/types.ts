export type Config = {
  atlassianSiteName: string;
  atlassianUserEmail: string;
  atlassianApiToken: string;
};

export type Requirements = {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  assumptions: string[];
};

export type Slice = {
  name: string;
  description: string;
};

export type PipelineContext = {
  issueKey: string;
  repoRoot: string;
  config: Config;
  branchName?: string;
  requirements?: Requirements;
  slices?: Slice[];
};
