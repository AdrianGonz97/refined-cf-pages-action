import { context } from '@actions/github';
import { summary } from '@actions/core';
import { config } from './config.js';
import type { Deployment } from '@cloudflare/types';
import type { Octokit } from './types.js';

type CreateGHDeploymentOpts = {
	octokit: Octokit;
	productionEnvironment: boolean;
	environment: string;
};
export async function createGithubDeployment({
	octokit,
	productionEnvironment,
	environment,
}: CreateGHDeploymentOpts) {
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

type CreateGHDeploymentStatusOpts = {
	octokit: Octokit;
	deploymentId: number;
	environmentUrl: string;
	cfDeploymentId: string;
	environmentName: string;
	productionEnvironment: boolean;
};

export async function createGithubDeploymentStatus(opts: CreateGHDeploymentStatusOpts) {
	return opts.octokit.rest.repos.createDeploymentStatus({
		owner: context.repo.owner,
		repo: context.repo.repo,
		deployment_id: opts.deploymentId,
		// @ts-expect-error this should accept a string
		environment: opts.environmentName,
		environment_url: opts.environmentUrl,
		production_environment: opts.productionEnvironment,
		log_url: `https://dash.cloudflare.com/${config.accountId}/pages/view/${config.projectName}/${opts.cfDeploymentId}`,
		description: 'Cloudflare Pages',
		state: 'success',
		auto_inactive: false,
	});
}

type CreateJobSummaryOpts = {
	deployment: Deployment;
	aliasUrl: string;
};
export async function createJobSummary({ aliasUrl, deployment }: CreateJobSummaryOpts) {
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
