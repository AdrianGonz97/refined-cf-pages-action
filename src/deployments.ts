import { context } from '@actions/github';
import { summary } from '@actions/core';
import { config } from './config.js';
import type { Deployment } from '@cloudflare/types';

type CreateGHDeploymentOpts = {
	productionEnvironment: boolean;
	environment: string;
	ref: string;
};
export async function createGithubDeployment({
	productionEnvironment,
	environment,
	ref,
}: CreateGHDeploymentOpts) {
	const deployment = await config.octokit.rest.repos.createDeployment({
		owner: context.repo.owner,
		repo: context.repo.repo,
		auto_merge: false,
		description: 'Cloudflare Pages',
		required_contexts: [],
		ref,
		environment,
		production_environment: productionEnvironment,
	});

	if (deployment.status === 201) {
		return deployment.data;
	}
}

type CreateGHDeploymentStatusOpts = {
	deploymentId: number;
	environmentUrl: string;
	cfDeploymentId: string;
	environmentName: string;
	productionEnvironment: boolean;
};

export async function createGithubDeploymentStatus(opts: CreateGHDeploymentStatusOpts) {
	return config.octokit.rest.repos.createDeploymentStatus({
		owner: context.repo.owner,
		repo: context.repo.repo,
		deployment_id: opts.deploymentId,
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
	sha: string;
};
export async function createJobSummary({ aliasUrl, deployment, sha }: CreateJobSummaryOpts) {
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
| **Last commit:**        | \`${sha.substring(0, 8)}\` |
| **Status**:             | ${deploymentStatus} |
| **Preview URL**:        | ${deployment.url} |
| **Branch Preview URL**: | ${aliasUrl} |
  `
		)
		.write({ overwrite: true });
}
