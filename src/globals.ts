import { context } from '@actions/github';

export const isPR: boolean = context.eventName === 'pull_request';

export const isWorkflowRun = context.eventName === 'workflow_run';
