import { context } from '@actions/github';
import { isPR, isWorkflowRun } from './globals.js';
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
		found = comments.data.find(({ body }) => body?.includes(`<!-- ${opts.messageId} -->`));

		if (found) break;
	}

	if (found) {
		const { id, body } = found;
		return { id, body };
	}
}

const Status = {
	success: '✅ Ready',
	fail: '❌ Failed',
	building: '🔨 Building',
} as const;

type CreatePRCommentOpts = {
	previewUrl: string;
	status: keyof typeof Status;
	issueNumber: number;
	runId: number;
	sha: string;
};
export async function createPRComment(opts: CreatePRCommentOpts) {
	if (!isPR && !isWorkflowRun) return;
	if (!config.comment) return;

	const messageId = `refined-cf-pages-action:deployment-summary:${context.repo.repo}`;
	const deploymentLogUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${opts.runId}`;
	const status = Status[opts.status];
	const row = createRow({ previewUrl: opts.previewUrl, sha: opts.sha, status, deploymentLogUrl });

	const existingComment = await findExistingComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issueNumber: opts.issueNumber,
		messageId,
	});

	if (existingComment === undefined || existingComment.body === undefined) {
		return await config.octokit.rest.issues.createComment({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: opts.issueNumber,
			body: createComment(messageId, row),
		});
	}

	let updatedBody: string;
	if (hasRow(existingComment.body)) {
		updatedBody = replaceRow(existingComment.body, row);
	} else {
		updatedBody = appendRow(existingComment.body, row);
	}

	return await config.octokit.rest.issues.updateComment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: opts.issueNumber,
		comment_id: existingComment.id,
		body: updatedBody,
	});
}

function hasRow(content: string) {
	const lines = content.split('\n');
	for (const line of lines) {
		if (line.includes(`| **${config.projectName}** |`)) return true;
	}
	return false;
}

function replaceRow(body: string, row: string): string {
	const lines = body.split('\n').map((line) => {
		const isProjectRow = hasRow(line);
		if (!isProjectRow) return line;

		return row;
	});

	return lines.join('\n');
}

function appendRow(body: string, row: string): string {
	return body.trim() + '\n' + row;
}

type CreateRowOpts = {
	previewUrl: string;
	deploymentLogUrl: string;
	status: string;
	sha: string;
};
function createRow(opts: CreateRowOpts): string {
	return `| **${config.projectName}** | ${opts.status} ([View Log](${opts.deploymentLogUrl})) | ${opts.previewUrl} | ${opts.sha} |`;
}

function createComment(messageId: string, row: string): string {
	return `<!-- ${messageId} -->

###### built with [Refined Cloudflare Pages Action](https://github.com/AdrianGonz97/refined-cf-pages-action)
## ⚡ Cloudflare Pages Deployment
| Name | Status | Preview | Last Commit |
| :--- | :----- | :------ | :---------- |
${row}
`;
}
