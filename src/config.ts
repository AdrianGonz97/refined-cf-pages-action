import { getInput, setFailed } from '@actions/core';
import { getOctokit } from '@actions/github';

function loadConfig() {
	try {
		const githubToken = getInput('githubToken', { required: true });
		return {
			githubToken,
			octokit: getOctokit(githubToken, { log: console }),
			apiToken: getInput('apiToken', { required: true }),
			accountId: getInput('accountId', { required: true }),
			projectName: getInput('projectName', { required: true }),
			directory: getInput('directory', { required: true }),
			branch: getInput('branch', { required: false }),
			deploymentName: getInput('deploymentName', { required: false }),
			workingDirectory: getInput('workingDirectory', { required: false }),
			wranglerVersion: getInput('wranglerVersion', { required: false }),
		};
	} catch (error) {
		// @ts-expect-error always print the message
		setFailed(error.message);
		process.exit(1);
	}
}

export const config = loadConfig();
