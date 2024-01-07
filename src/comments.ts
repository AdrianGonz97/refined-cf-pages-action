import type { getOctokit } from "@actions/github";

type Octokit = ReturnType<typeof getOctokit>;

export async function findExistingComment(opts: {
	octokit: Octokit;
	owner: string;
	repo: string;
	issueNumber: number;
	projectName: string;
}) {
	const messageId = `deployment-comment:${opts.projectName}`;
	const params = {
		owner: opts.owner,
		repo: opts.repo,
		issue_number: opts.issueNumber,
		per_page: 100,
	};

	let found;

	for await (const comments of opts.octokit.paginate.iterator(opts.octokit.rest.issues.listComments, params)) {
		found = comments.data.find(({ body }) => {
			return (body?.search(messageId) ?? -1) > -1;
		});

		if (found) {
			break;
		}
	}

	if (found) {
		const { id, body } = found as { id: number; body: string };
		return { id, body };
	}

	return;
}
