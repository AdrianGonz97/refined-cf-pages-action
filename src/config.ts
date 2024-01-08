import { getInput, setFailed } from '@actions/core';

function loadConfig() {
	try {
		return {
			apiToken: getInput('apiToken', { required: true }),
			accountId: getInput('accountId', { required: true }),
			projectName: getInput('projectName', { required: true }),
			directory: getInput('directory', { required: true }),
			gitHubToken: getInput('gitHubToken', { required: false }),
			branch: getInput('branch', { required: false }),
			deploymentName: getInput('deploymentName', { required: false }),
			workingDirectory: getInput('workingDirectory', { required: false }),
			wranglerVersion: getInput('wranglerVersion', { required: false }),
		};
	} catch (error) {
		setFailed(error.message);
	} finally {
		process.exit(1);
	}
}

export const config = loadConfig();