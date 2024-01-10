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

	const octokit = getOctokit(config.githubToken);
	await createPRComment({
		octokit,
		title: '⚡️ Preparing Cloudflare Pages deployment',
		previewUrl: '🔨 Building Preview',
		environment: '...',
	});

	let githubDeployment: Awaited<ReturnType<typeof createGithubDeployment>>;
	if (config.deploymentName.length > 0) {
		githubDeployment = await createGithubDeployment({
			octokit,
			productionEnvironment,
			environment: config.deploymentName,
		});
	}

	const pagesDeployment = await createPagesDeployment(productionEnvironment);
	let alias = pagesDeployment.url;

	await createJobSummary({ deployment: pagesDeployment, aliasUrl: pagesDeployment.url });

	if (githubDeployment) {
		await createGithubDeploymentStatus({
			octokit,
			productionEnvironment,
			environmentName: githubDeployment.environment,
			deploymentId: githubDeployment.id,
			environmentUrl: pagesDeployment.url,
			cfDeploymentId: pagesDeployment.id,
		});
	}

	// we sleep to give CF enough time to update their deployment status
	await new Promise((resolve) => setTimeout(resolve, 5000));
	const deployment = await getPagesDeployment();

	if (!productionEnvironment && deployment.aliases && deployment.aliases.length > 0) {
		alias = deployment.aliases[0]!; // we can assert that idx 0 exists
	}

	await createPRComment({
		octokit,
		title: '✅ Successful Cloudflare Pages deployment',
		previewUrl: `[Visit Preview](${alias})`,
		environment: deployment.environment,
	});

	setOutput('id', deployment.id);
	setOutput('url', deployment.url);
	setOutput('environment', deployment.environment);

	setOutput('alias', alias);
	await createJobSummary({ deployment, aliasUrl: alias });
}

try {
	main();
} catch (error) {
	// @ts-expect-error always print the message
	setFailed(error.message);
}
