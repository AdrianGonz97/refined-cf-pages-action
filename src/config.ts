import { getInput, setFailed } from '@actions/core';

function loadConfig() {
	try {
		return {
			apiToken: getInput('apiToken', { required: true }),
			accountId: getInput('accountId', { required: true }),
			projectName: getInput('projectName', { required: true }),
			directory: getInput('directory', { required: true }),
			githubToken: getInput('githubToken', { required: false }),
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
