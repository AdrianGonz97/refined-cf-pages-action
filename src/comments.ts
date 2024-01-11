import { context } from '@actions/github';
import { isPR } from './globals.js';
import { config } from './config.js';

type FindExistingCommentOpts = {
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

	const listComments = config.octokit.rest.issues.listComments;
	let found: Awaited<ReturnType<typeof listComments>>['data'][number] | undefined;

	for await (const comments of config.octokit.paginate.iterator(listComments, params)) {
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

const Status = {
	success: '✅ Ready',
	fail: '❌ Failed',
	building: '🔨 Building',
} as const;

type CreatePRCommentOpts = {
	previewUrl: string;
	status: keyof typeof Status;
};
export async function createPRComment(opts: CreatePRCommentOpts) {
	if (!isPR) return;

	const messageId = `deployment-comment:${config.projectName}`;
	const deploymentLogUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

	const body = `<!-- ${messageId} -->

### ⚡ Cloudflare Pages Deployment
| Name | Status | Preview | Last Commit |
| :--- | :----- | :------ | :---------- |
| **${config.projectName}** | ${Status[opts.status]} ([View Log](${deploymentLogUrl})) | ${
		opts.previewUrl
	} | ${context.payload.pull_request?.head.sha || context.ref} |
`;

	const existingComment = await findExistingComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issueNumber: context.issue.number,
		messageId,
	});

	if (existingComment !== undefined) {
		return await config.octokit.rest.issues.updateComment({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
			comment_id: existingComment.id,
			body,
		});
	}

	return await config.octokit.rest.issues.createComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: context.issue.number,
		body,
	});
}
