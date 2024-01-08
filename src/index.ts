import { setOutput, setFailed } from '@actions/core';
import { getOctokit } from '@actions/github';
import { config } from './config.js';
import { createPRComment } from './comments.js';
import { githubBranch } from './globals.js';
import {
	createGithubDeployment,
	createGithubDeploymentStatus,
	createJobSummary,
} from './deployments.js';
import { createPagesDeployment, getPagesDeployment, getPagesProject } from './cloudflare.js';

async function main() {
	const project = await getPagesProject();

	const productionEnvironment =
		githubBranch === project.production_branch || config.branch === project.production_branch;
	const environmentName =
		config.deploymentName || `${productionEnvironment ? 'Production' : 'Preview'}`;

	let githubDeployment: Awaited<ReturnType<typeof createGithubDeployment>>;

	if (config.githubToken && config.githubToken.length) {
		const octokit = getOctokit(config.githubToken);
		await createPRComment({
			octokit,
			title: '⚡️ Preparing Cloudflare Pages deployment',
			previewUrl: '🔨 Building Preview',
			environment: '...',
		});
		githubDeployment = await createGithubDeployment({
			octokit,
			productionEnvironment,
			environment: environmentName,
		});
	}

	const pagesDeployment = await createPagesDeployment(productionEnvironment);
	setOutput('id', pagesDeployment.id);
	setOutput('url', pagesDeployment.url);
	setOutput('environment', pagesDeployment.environment);

	let alias = pagesDeployment.url;
	if (!productionEnvironment && pagesDeployment.aliases && pagesDeployment.aliases.length > 0) {
		alias = pagesDeployment.aliases[0]!; // we can assert that idx 0 exists
	}
	setOutput('alias', alias);

	await createJobSummary({ deployment: pagesDeployment, aliasUrl: alias });

	if (githubDeployment) {
		const octokit = getOctokit(config.githubToken);

		await createGithubDeploymentStatus({
			octokit,
			environmentName,
			productionEnvironment,
			deploymentId: githubDeployment.id,
			environmentUrl: pagesDeployment.url,
			cfDeploymentId: pagesDeployment.id,
		});

		await createPRComment({
			octokit,
			title: '✅ Successful Cloudflare Pages deployment',
			previewUrl: pagesDeployment.url,
			environment: pagesDeployment.environment,
		});

		// we sleep to give CF enough time to update their deployment status
		await new Promise((resolve) => setTimeout(resolve, 5000));
		const deployment = await getPagesDeployment();
		await createJobSummary({ deployment, aliasUrl: alias });
	}
}

try {
	main();
} catch (error) {
	// @ts-expect-error always print the message
	setFailed(error.message);
}
