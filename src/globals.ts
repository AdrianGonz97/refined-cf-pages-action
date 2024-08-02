import { context } from '@actions/github';
import { config } from './config.js';

export const isPR: boolean =
	context.eventName === 'pull_request' || context.eventName === 'pull_request_target';

export const isWorkflowRun = context.eventName === 'workflow_run' && Boolean(config.runId);
