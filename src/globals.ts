import { context } from '@actions/github';
import { env } from 'process';

export const githubBranch: string = env.GITHUB_HEAD_REF || (env.GITHUB_REF_NAME as string);

export const prBranchOwner: string | undefined =
	context.payload.pull_request?.head.repo.owner.login;

export const isPR: boolean =
	context.eventName === 'pull_request' || context.eventName === 'pull_request_target';

export const isWorkflowRun = context.eventName === 'workflow_run';
