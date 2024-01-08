import { getInput, setOutput, setFailed, summary } from '@actions/core';
import type { Project, Deployment } from '@cloudflare/types';
import { context, getOctokit } from '@actions/github';
import shellac from 'shellac';
import { fetch } from 'undici';
import { env } from 'process';
import path from 'node:path';
import { findExistingComment } from './comments.js';

type Octokit = ReturnType<typeof getOctokit>;

try {
	const apiToken = getInput('apiToken', { required: true });
	const accountId = getInput('accountId', { required: true });
	const projectName = getInput('projectName', { required: true });
	const directory = getInput('directory', { required: true });
	const gitHubToken = getInput('gitHubToken', { required: false });
	const branch = getInput('branch', { required: false });
	const deploymentName = getInput('deploymentName', { required: false });
	const workingDirectory = getInput('workingDirectory', { required: false });
	const wranglerVersion = getInput('wranglerVersion', { required: false });

	const githubBranch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME;
	const username = context.payload.pull_request?.head.repo.owner.login;
	const isPR = context.eventName === 'pull_request' || context.eventName === 'pull_request_target';

	async function getProject() {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
			{ headers: { Authorization: `Bearer ${apiToken}` } }
		);
		if (response.status !== 200) {
			console.error(`Cloudflare API returned non-200: ${response.status}`);
			const json = await response.text();
			console.error(`API returned: ${json}`);
			throw new Error('Failed to get Pages project, API returned non-200');
		}

		const { result } = (await response.json()) as { result: Project | null };
		if (result === null) {
			throw new Error(
				'Failed to get Pages project, project does not exist. Check the project name or create it!'
			);
		}

		return result;
	}

	async function createPRComment(
		octokit: Octokit,
		title: string,
		previewUrl: string,
		environment: string
	) {
		if (!isPR) return;

		const messageId = `deployment-comment:${projectName}`;

		const body = `<!-- ${messageId} -->

### ${title}
| Name | Link |
| :--- | :--- |
| Latest commit | ${context.payload.pull_request?.head.sha || context.ref} |
| Latest deploy log | ${context.serverUrl}/${context.repo.owner}/${
			context.repo.repo
		}/actions/runs/${context.runId} |
| Preview URL | ${previewUrl} |
| Environment | ${environment} |
`;

		const existingComment = await findExistingComment({
			octokit,
			owner: context.repo.owner,
			repo: context.repo.repo,
			issueNumber: context.issue.number,
			messageId,
		});

		if (existingComment !== undefined) {
			return await octokit.rest.issues.updateComment({
				owner: context.repo.owner,
				repo: context.repo.repo,
				issue_number: context.issue.number,
				comment_id: existingComment.id,
				body,
			});
		}

		return await octokit.rest.issues.createComment({
			owner: context.repo.owner,
			repo: context.repo.repo,
			issue_number: context.issue.number,
			body,
		});
	}

	async function createPagesDeployment(isProd: boolean) {
		const branchName = isProd ? branch : `${username}-${branch || githubBranch}`;
		// TODO: Replace this with an API call to wrangler so we can get back a full deployment response object
		await shellac.in(path.join(process.cwd(), workingDirectory))`
    $ export CLOUDFLARE_API_TOKEN="${apiToken}"
    if ${accountId} {
      $ export CLOUDFLARE_ACCOUNT_ID="${accountId}"
    }
  
    $$ npx wrangler@${wranglerVersion} pages deploy "${directory}" --project-name="${projectName}" --branch="${branchName}"
    `;

		return getPagesDeployment();
	}

	async function getPagesDeployment() {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
			{ headers: { Authorization: `Bearer ${apiToken}` } }
		);
		const {
			result: [deployment],
		} = (await response.json()) as { result: Deployment[] };

		return deployment;
	}

	async function createGitHubDeployment(
		octokit: Octokit,
		productionEnvironment: boolean,
		environment: string
	) {
		const deployment = await octokit.rest.repos.createDeployment({
			owner: context.repo.owner,
			repo: context.repo.repo,
			ref: context.payload.pull_request?.head.sha || context.ref,
			auto_merge: false,
			description: 'Cloudflare Pages',
			required_contexts: [],
			environment,
			production_environment: productionEnvironment,
		});

		if (deployment.status === 201) {
			return deployment.data;
		}
	}

	async function createGitHubDeploymentStatus({
		id,
		url,
		deploymentId,
		environmentName,
		productionEnvironment,
		octokit,
	}: {
		octokit: Octokit;
		id: number;
		url: string;
		deploymentId: string;
		environmentName: string;
		productionEnvironment: boolean;
	}) {
		return octokit.rest.repos.createDeploymentStatus({
			owner: context.repo.owner,
			repo: context.repo.repo,
			deployment_id: id,
			// @ts-expect-error
			environment: environmentName,
			environment_url: url,
			production_environment: productionEnvironment,
			log_url: `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}/${deploymentId}`,
			description: 'Cloudflare Pages',
			state: 'success',
			auto_inactive: false,
		});
	}

	async function createJobSummary(opts: { deployment: Deployment; aliasUrl: string }) {
		const { aliasUrl, deployment } = opts;
		const deployStage = deployment.stages.find((stage) => stage.name === 'deploy');

		let deploymentStatus = '⚡️ Deployment in progress...';
		if (deployStage?.status === 'success') {
			deploymentStatus = '✅ Deployment successful!';
		} else if (deployStage?.status === 'failure') {
			deploymentStatus = '🚫 Deployment failed';
		}

		await summary
			.addRaw(
				`
# Deploying with Cloudflare Pages

| Name                    | Result |
| ----------------------- | - |
| **Last commit:**        | \`${deployment.deployment_trigger.metadata.commit_hash.substring(
					0,
					8
				)}\` |
| **Status**:             | ${deploymentStatus} |
| **Preview URL**:        | ${deployment.url} |
| **Branch Preview URL**: | ${aliasUrl} |
      `
			)
			.write({ overwrite: true });
	}

	(async () => {
		const project = await getProject();

		const productionEnvironment =
			githubBranch === project.production_branch || branch === project.production_branch;
		const environmentName = deploymentName || `${productionEnvironment ? 'Production' : 'Preview'}`;

		let gitHubDeployment: Awaited<ReturnType<typeof createGitHubDeployment>>;

		if (gitHubToken && gitHubToken.length) {
			const octokit = getOctokit(gitHubToken);
			await createPRComment(
				octokit,
				'⚡️ Preparing Cloudflare Pages deployment',
				'🔨 Building Preview',
				'...'
			);
			gitHubDeployment = await createGitHubDeployment(
				octokit,
				productionEnvironment,
				environmentName
			);
		}

		const pagesDeployment = await createPagesDeployment(productionEnvironment);
		setOutput('id', pagesDeployment.id);
		setOutput('url', pagesDeployment.url);
		setOutput('environment', pagesDeployment.environment);

		let alias = pagesDeployment.url;
		if (!productionEnvironment && pagesDeployment.aliases && pagesDeployment.aliases.length > 0) {
			alias = pagesDeployment.aliases[0];
		}
		setOutput('alias', alias);

		await createJobSummary({ deployment: pagesDeployment, aliasUrl: alias });

		if (gitHubDeployment) {
			const octokit = getOctokit(gitHubToken);

			await createGitHubDeploymentStatus({
				id: gitHubDeployment.id,
				url: pagesDeployment.url,
				deploymentId: pagesDeployment.id,
				environmentName,
				productionEnvironment,
				octokit,
			});

			await createPRComment(
				octokit,
				'✅ Successful Cloudflare Pages deployment',
				pagesDeployment.url,
				pagesDeployment.environment
			);

			// we sleep to give CF enough time to update their deployment status
			await new Promise((resolve) => setTimeout(resolve, 5000));
			const deployment = await getPagesDeployment();
			await createJobSummary({ deployment, aliasUrl: alias });
		}
	})();
} catch (thrown) {
	setFailed(thrown.message);
}
