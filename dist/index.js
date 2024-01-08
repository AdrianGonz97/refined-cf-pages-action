// src/index.ts
import { setOutput, setFailed as setFailed2 } from "@actions/core";
import { getOctokit } from "@actions/github";

// src/config.ts
import { getInput, setFailed } from "@actions/core";
function loadConfig() {
  try {
    return {
      apiToken: getInput("apiToken", { required: true }),
      accountId: getInput("accountId", { required: true }),
      projectName: getInput("projectName", { required: true }),
      directory: getInput("directory", { required: true }),
      gitHubToken: getInput("gitHubToken", { required: false }),
      branch: getInput("branch", { required: false }),
      deploymentName: getInput("deploymentName", { required: false }),
      workingDirectory: getInput("workingDirectory", { required: false }),
      wranglerVersion: getInput("wranglerVersion", { required: false })
    };
  } catch (error) {
    setFailed(error.message);
    process.exit(1);
  }
}
var config = loadConfig();

// src/comments.ts
import { context as context2 } from "@actions/github";

// src/globals.ts
import { context } from "@actions/github";
import { env } from "process";
var githubBranch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME;
var prBranchOwner = context.payload.pull_request?.head.repo.owner.login;
var isPR = context.eventName === "pull_request" || context.eventName === "pull_request_target";

// src/comments.ts
async function findExistingComment(opts) {
  const params = {
    owner: opts.owner,
    repo: opts.repo,
    issue_number: opts.issueNumber,
    per_page: 100
  };
  const listComments = opts.octokit.rest.issues.listComments;
  let found;
  for await (const comments of opts.octokit.paginate.iterator(listComments, params)) {
    found = comments.data.find(({ body }) => {
      return (body?.search(opts.messageId) ?? -1) > -1;
    });
    if (found) {
      break;
    }
  }
  if (found) {
    const { id, body } = found;
    return { id, body };
  }
  return;
}
async function createPRComment(opts) {
  if (!isPR)
    return;
  const messageId = `deployment-comment:${config.projectName}`;
  const body = `<!-- ${messageId} -->

### ${opts.title}
| Name | Link |
| :--- | :--- |
| Latest commit | ${context2.payload.pull_request?.head.sha || context2.ref} |
| Latest deploy log | ${context2.serverUrl}/${context2.repo.owner}/${context2.repo.repo}/actions/runs/${context2.runId} |
| Preview URL | ${opts.previewUrl} |
| Environment | ${opts.environment} |
`;
  const existingComment = await findExistingComment({
    octokit: opts.octokit,
    owner: context2.repo.owner,
    repo: context2.repo.repo,
    issueNumber: context2.issue.number,
    messageId
  });
  if (existingComment !== void 0) {
    return await opts.octokit.rest.issues.updateComment({
      owner: context2.repo.owner,
      repo: context2.repo.repo,
      issue_number: context2.issue.number,
      comment_id: existingComment.id,
      body
    });
  }
  return await opts.octokit.rest.issues.createComment({
    owner: context2.repo.owner,
    repo: context2.repo.repo,
    issue_number: context2.issue.number,
    body
  });
}

// src/deployments.ts
import { context as context3 } from "@actions/github";
import { summary } from "@actions/core";
async function createGitHubDeployment({
  octokit,
  productionEnvironment,
  environment
}) {
  const deployment = await octokit.rest.repos.createDeployment({
    owner: context3.repo.owner,
    repo: context3.repo.repo,
    ref: context3.payload.pull_request?.head.sha || context3.ref,
    auto_merge: false,
    description: "Cloudflare Pages",
    required_contexts: [],
    environment,
    production_environment: productionEnvironment
  });
  if (deployment.status === 201) {
    return deployment.data;
  }
}
async function createGitHubDeploymentStatus(opts) {
  return opts.octokit.rest.repos.createDeploymentStatus({
    owner: context3.repo.owner,
    repo: context3.repo.repo,
    deployment_id: opts.deploymentId,
    // @ts-expect-error this should accept a string
    environment: opts.environmentName,
    environment_url: opts.environmentUrl,
    production_environment: opts.productionEnvironment,
    log_url: `https://dash.cloudflare.com/${config.accountId}/pages/view/${config.projectName}/${opts.cfDeploymentId}`,
    description: "Cloudflare Pages",
    state: "success",
    auto_inactive: false
  });
}
async function createJobSummary({ aliasUrl, deployment }) {
  const deployStage = deployment.stages.find((stage) => stage.name === "deploy");
  let deploymentStatus = "\u26A1\uFE0F Deployment in progress...";
  if (deployStage?.status === "success") {
    deploymentStatus = "\u2705 Deployment successful!";
  } else if (deployStage?.status === "failure") {
    deploymentStatus = "\u{1F6AB} Deployment failed";
  }
  await summary.addRaw(
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
  ).write({ overwrite: true });
}

// src/cloudflare.ts
import shellac from "shellac";
import path from "path";
import { fetch } from "undici";
async function getPagesProject() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}`,
    { headers: { Authorization: `Bearer ${config.apiToken}` } }
  );
  if (response.status !== 200) {
    console.error(`Cloudflare API returned non-200: ${response.status}`);
    const json = await response.text();
    console.error(`API returned: ${json}`);
    throw new Error("Failed to get Cloudflare Pages project, API returned non-200");
  }
  const { result } = await response.json();
  if (!result) {
    throw new Error(
      "Failed to get Cloudflare Pages project, project does not exist. Check the project name or create it!"
    );
  }
  return result;
}
async function createPagesDeployment(isProd) {
  const branchName = isProd ? config.branch : `${prBranchOwner}-${config.branch || githubBranch}`;
  await shellac.in(path.join(process.cwd(), config.workingDirectory))`
$ export CLOUDFLARE_API_TOKEN="${config.apiToken}"
if ${config.accountId} {
  $ export CLOUDFLARE_ACCOUNT_ID="${config.accountId}"
}

$$ npx wrangler@${config.wranglerVersion} pages deploy "${config.directory}" --project-name="${config.projectName}" --branch="${branchName}"
`;
  return getPagesDeployment();
}
async function getPagesDeployment() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}/deployments`,
    { headers: { Authorization: `Bearer ${config.apiToken}` } }
  );
  const {
    result: [deployment]
  } = await response.json();
  if (!deployment) {
    throw new Error(
      `Failed to get Cloudflare Pages deployment for project "${config.projectName}"`
    );
  }
  return deployment;
}

// src/index.ts
async function main() {
  const project = await getPagesProject();
  const productionEnvironment = githubBranch === project.production_branch || config.branch === project.production_branch;
  const environmentName = config.deploymentName || `${productionEnvironment ? "Production" : "Preview"}`;
  let gitHubDeployment;
  if (config.gitHubToken && config.gitHubToken.length) {
    const octokit = getOctokit(config.gitHubToken);
    await createPRComment({
      octokit,
      title: "\u26A1\uFE0F Preparing Cloudflare Pages deployment",
      previewUrl: "\u{1F528} Building Preview",
      environment: "..."
    });
    gitHubDeployment = await createGitHubDeployment({
      octokit,
      productionEnvironment,
      environment: environmentName
    });
  }
  const pagesDeployment = await createPagesDeployment(productionEnvironment);
  setOutput("id", pagesDeployment.id);
  setOutput("url", pagesDeployment.url);
  setOutput("environment", pagesDeployment.environment);
  let alias = pagesDeployment.url;
  if (!productionEnvironment && pagesDeployment.aliases && pagesDeployment.aliases.length > 0) {
    alias = pagesDeployment.aliases[0];
  }
  setOutput("alias", alias);
  await createJobSummary({ deployment: pagesDeployment, aliasUrl: alias });
  if (gitHubDeployment) {
    const octokit = getOctokit(config.gitHubToken);
    await createGitHubDeploymentStatus({
      octokit,
      environmentName,
      productionEnvironment,
      deploymentId: gitHubDeployment.id,
      environmentUrl: pagesDeployment.url,
      cfDeploymentId: pagesDeployment.id
    });
    await createPRComment({
      octokit,
      title: "\u2705 Successful Cloudflare Pages deployment",
      previewUrl: pagesDeployment.url,
      environment: pagesDeployment.environment
    });
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    const deployment = await getPagesDeployment();
    await createJobSummary({ deployment, aliasUrl: alias });
  }
}
try {
  main();
} catch (error) {
  setFailed2(error.message);
}
