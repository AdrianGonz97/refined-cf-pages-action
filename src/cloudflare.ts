import shellac from 'shellac';
import path from 'node:path';
import { fetch } from 'undici';
import { config } from './config';
import { githubBranch, prBranchOwner } from './globals';
import type { Deployment, Project } from '@cloudflare/types';

export async function getPagesProject() {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}`,
		{ headers: { Authorization: `Bearer ${config.apiToken}` } }
	);
	if (response.status !== 200) {
		console.error(`Cloudflare API returned non-200: ${response.status}`);
		const json = await response.text();
		console.error(`API returned: ${json}`);
		throw new Error('Failed to get Cloudflare Pages project, API returned non-200');
	}

	const { result } = (await response.json()) as { result: Project | null };
	if (result === null) {
		throw new Error(
			'Failed to get Cloudflare Pages project, project does not exist. Check the project name or create it!'
		);
	}

	return result;
}

export async function createPagesDeployment(isProd: boolean) {
	const branchName = isProd ? config.branch : `${prBranchOwner}-${config.branch || githubBranch}`;
	// TODO: Replace this with an API call to wrangler so we can get back a full deployment response object
	await shellac.in(path.join(process.cwd(), config.workingDirectory))`
$ export CLOUDFLARE_API_TOKEN="${config.apiToken}"
if ${config.accountId} {
  $ export CLOUDFLARE_ACCOUNT_ID="${config.accountId}"
}

$$ npx wrangler@${config.wranglerVersion} pages deploy "${config.directory}" --project-name="${config.projectName}" --branch="${branchName}"
`;

	return getPagesDeployment();
}

export async function getPagesDeployment() {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}/deployments`,
		{ headers: { Authorization: `Bearer ${config.apiToken}` } }
	);
	const {
		result: [deployment],
	} = (await response.json()) as { result: Deployment[] };

	return deployment;
}
