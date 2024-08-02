import { context } from '@actions/github';
import { setOutput, setFailed } from '@actions/core';
import { config } from './config.js';
import { createPRComment } from './comments.js';
import { githubBranch, isWorkflowRun } from './globals.js';
import {
	createGithubDeployment,
	createGithubDeploymentStatus,
	createJobSummary,
} from './deployments.js';
import { createPagesDeployment, getPagesDeployment, getPagesProject } from './cloudflare.js';

async function main() {
	const workflowRun =
		isWorkflowRun && config.runId
			? await config.octokit.rest.actions.getWorkflowRun({
					owner: context.repo.owner,
					repo: context.repo.repo,
					run_id: config.runId,
				})
			: undefined;

	const pr = workflowRun?.data.pull_requests?.[0];
	console.dir(
		{ workflow: workflowRun?.data },
		{ maxArrayLength: Infinity, maxStringLength: Infinity, depth: Infinity }
	);
	const issueNumber = pr?.id ?? context.issue.number;
	const runId = config.runId ?? context.runId;

	await createPRComment({
		status: 'building',
		previewUrl: '',
		issueNumber,
		runId,
	});

	const project = await getPagesProject();

	const productionEnvironment =
		githubBranch === project.production_branch || config.branch === project.production_branch;

	let githubDeployment: Awaited<ReturnType<typeof createGithubDeployment>>;
	if (config.deploymentName.length > 0) {
		githubDeployment = await createGithubDeployment({
			productionEnvironment,
			environment: config.deploymentName,
			ref: pr?.head.ref ?? context.ref,
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
		issueNumber,
		runId,
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
			issueNumber: undefined ?? context.issue.number,
			runId: config.runId ?? context.runId,
		});
	}
})();
