import { setOutput, setFailed } from '@actions/core';
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
	await createPRComment({
		status: 'building',
		previewUrl: '',
	});

	const project = await getPagesProject();

	const productionEnvironment =
		githubBranch === project.production_branch || config.branch === project.production_branch;

	let githubDeployment: Awaited<ReturnType<typeof createGithubDeployment>>;
	if (config.deploymentName.length > 0) {
		githubDeployment = await createGithubDeployment({
			productionEnvironment,
			environment: config.deploymentName,
		});
	}

	const pagesDeployment = await createPagesDeployment(productionEnvironment);
	let alias = pagesDeployment.url;

	await createJobSummary({ deployment: pagesDeployment, aliasUrl: pagesDeployment.url });

	if (githubDeployment) {
		await createGithubDeploymentStatus({
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
		status: 'success',
		previewUrl: `[Visit Preview](${alias})`,
	});

	setOutput('id', deployment.id);
	setOutput('url', deployment.url);
	setOutput('environment', deployment.environment);

	setOutput('alias', alias);
	await createJobSummary({ deployment, aliasUrl: alias });
}

(async () => {
	try {
		await main();
	} catch (error) {
		// @ts-expect-error always print the message
		setFailed(error.message);

		await createPRComment({
			status: 'fail',
			previewUrl: '',
		});
	}
})();
