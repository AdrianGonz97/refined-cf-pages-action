import { context } from '@actions/github';
import { isPR } from './globals.js';
import { config } from './config.js';
import type { Octokit } from './types.js';

type FindExistingCommentOpts = {
	octokit: Octokit;
	owner: string;
	repo: string;
	issueNumber: number;
	messageId: string;
};

export async function findExistingComment(opts: FindExistingCommentOpts) {
	const params = {
		owner: opts.owner,
		repo: opts.repo,
		issue_number: opts.issueNumber,
		per_page: 100,
	};

	const listComments = opts.octokit.rest.issues.listComments;
	let found: Awaited<ReturnType<typeof listComments>>['data'][number] | undefined;

	for await (const comments of opts.octokit.paginate.iterator(listComments, params)) {
		found = comments.data.find(({ body }) => {
			return (body?.search(opts.messageId) ?? -1) > -1;
		});

		if (found) {
			break;
		}
	}

	if (found) {
		const { id, body } = found;
		return { id, body };
	}

	return;
}

type CreatePRCommentOpts = {
	octokit: Octokit;
	title: string;
	previewUrl: string;
	environment: string;
};

export async function createPRComment(opts: CreatePRCommentOpts) {
	if (!isPR) return;

	const messageId = `deployment-comment:${config.projectName}`;

	const body = `<!-- ${messageId} -->

### ${opts.title}
| Name | Link |
| :--- | :--- |
| Latest commit | ${context.payload.pull_request?.head.sha || context.ref} |
| Latest deploy log | ${context.serverUrl}/${context.repo.owner}/${
		context.repo.repo
	}/actions/runs/${context.runId} |
| Preview URL | ${opts.previewUrl} |
| Environment | ${opts.environment} |
`;

	const existingComment = await findExistingComment({
		octokit: opts.octokit,
		owner: context.repo.owner,
		repo: context.repo.repo,
		issueNumber: context.issue.number,
		messageId,
	});

	if (existingComment !== undefined) {
		return await opts.octokit.rest.issues.updateComment({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
			comment_id: existingComment.id,
			body,
		});
	}

	return await opts.octokit.rest.issues.createComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: context.issue.number,
		body,
	});
}
