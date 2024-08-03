<p align="center">
 <img align="center" src="https://raw.githubusercontent.com/AdrianGonz97/cf-pages-action/main/.github/assets/icon.png" height="96" />
 <h1 align="center">Refined Cloudflare Pages Action</h1>
</p>

> An opinionated fork of the official [Cloudflare Pages Action](https://github.com/cloudflare/pages-action).

A GitHub Action for creating Cloudflare Pages deployments, using [Direct Upload](https://developers.cloudflare.com/pages/platform/direct-upload/) with [Wrangler](https://developers.cloudflare.com/pages/platform/direct-upload/#wrangler-cli).

## Advantages over official solutions

- ✅ Generated build summaries
- ✅ Deploy multiple sites from a single monorepo
- ✅ Builds site previews of PRs from forked repositories, [a known issue](https://developers.cloudflare.com/pages/platform/known-issues/#builds-and-deployment) with official solutions
- ✅ GitHub Deployments on PRs from forks

## Usage

> [!IMPORTANT]
> This action entirely replaces the Cloudflare Pages GitHub integration. Before continuing, you should [disable the automatic builds](#disabling-the-cloudflare-pages-github-integration) made by Cloudflare for the repository you are applying this action to.

1. [Locate your Cloudflare account ID](#get-account-id).
2. [Generate an API token](#generate-an-api-token).
3. Add the Cloudflare account ID and API token [as secrets to your GitHub repository](#add-cloudflare-credentials-to-github-secrets).
4. Create a `.github/workflows/publish.yml` file in your repository:

```yml
on:
  push:
    branches:
      - main

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    name: Publish to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      # Run a build step here if your project requires one

      - name: Publish to Cloudflare Pages
        uses: AdrianGonz97/refined-cf-pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          projectName: YOUR_PROJECT_NAME
          directory: YOUR_BUILD_OUTPUT_DIRECTORY
          # Optional: Supply a deployment name if you want to have GitHub Deployments triggered
          deploymentName: Production
          # Optional: Switch what branch you are publishing to.
          # By default, this will be the branch which triggered this workflow
          branch: main
          # Optional: Change the working directory
          workingDirectory: my-site
          # Optional: Change the Wrangler version, allows you to point to a specific version or a tag such as `beta`
          wranglerVersion: '3'
```

5. Replace `YOUR_PROJECT_NAME` and `YOUR_BUILD_OUTPUT_DIRECTORY` with the appropriate values to your Pages project.

And you're ready to go!

> [!TIP]
> Be sure to check out the [_Enabling PR Previews from Forks_](#enabling-pr-previews-from-forks) section if you're interested in enabling this particular feature.

### Get account ID

To find your account ID, log in to the Cloudflare dashboard > select your zone in Account Home > find your account ID in Overview under **API** on the right-side menu. If you have not added a zone, add one by selecting **Add site**.

If you do not have a zone registered to your account, you can also get your account ID from the `pages.dev` URL. E.g: `https://dash.cloudflare.com/<ACCOUNT_ID>/pages`

### Generate an API Token

To generate an API token:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
1. Select **My Profile** from the dropdown menu of your user icon on the top right of your dashboard.
1. Select **API Tokens** > **Create Token**.
1. Under **Custom Token**, select **Get started**.
1. Name your API Token in the **Token name** field.
1. Under **Permissions**, select **Account**, **Cloudflare Pages** and **Edit**:
1. Select **Continue to summary** > **Create Token**.

### Add Cloudflare credentials to GitHub secrets

1. Go to your project’s repository in GitHub.
1. Under your repository’s name, select **Settings**.
1. Select **Secrets and variables** > **Actions** > **New repository secret**.
1. Create a secret and put `CLOUDFLARE_ACCOUNT_ID` as the name with the value being your Cloudflare account ID.
1. Create another secret and put `CLOUDFLARE_API_TOKEN` as the name with the value being your Cloudflare API token.

### Disabling the Cloudflare Pages GitHub integration

If you have already connected your repository to the [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/), you'll need to disable it.

1. Go to your project’s repository in GitHub.
1. Under your repository’s name, select **Settings**.
1. Select **GitHub Apps**, and next to Cloudflare Pages, select **Configure**
1. Under **Repository access**, select **Only select repositories**, and remove your repository.

### Enabling PR Previews from Forks

If your site _does not_ use/have any runtime secrets in your **preview environment on Cloudflare**, then it should be fine to use as-is. We use this method in [shadcn-svelte](https://github.com/huntabyte/shadcn-svelte) and its implementation can be found in this [workflow file](https://github.com/huntabyte/shadcn-svelte/blob/main/.github/workflows).

<details><summary>Example: Preview Deployment with <b>NO RUNTIME/BUILD-TIME SECRETS</b></summary>
<p>

First we'll build the project in an unprivileged environment where secrets are not exposed. This allows use to safely run untrusted code:

```yaml
# build-preview.yml
name: Build Preview Deployment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  build-preview:
    runs-on: ubuntu-latest
    name: Build Preview Site and Upload Build Artifact
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Run your install/build steps here
      # ...

      # Build example
      - name: Build site
        run: pnpm build
        env:
          # if you need environment variables that are _NOT secrets_, apply them here during build
          # using GH Action variables
          SOME_ENV_VAR: ${{ vars.SOME_ENV_VAR }}

      # Uploads the build directory as a workflow artifact
      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: preview-build
          path: YOUR_BUILD_OUTPUT_DIRECTORY
```

Then we'll deploy the project to Cloudflare in a privileged environment where we can safely use secrets (i.e. your cloudflare credentials):

```yaml
# deploy-preview.yml
name: Upload Preview Deployment
on:
  workflow_run:
    workflows: ['Build Preview Deployment']
    types:
      - completed

permissions:
  actions: read
  deployments: write
  contents: read
  pull-requests: write

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    name: Deploy Preview to Cloudflare Pages
    steps:
      # Downloads the build directory from the previous workflow
      - name: Download build artifact
        uses: actions/download-artifact@v4
        id: preview-build-artifact
        with:
          name: preview-build
          path: build
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}

      - name: Deploy to Cloudflare Pages
        uses: AdrianGonz97/refined-cf-pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          projectName: YOUR_PROJECT_NAME
          deploymentName: Preview
          directory: ${{ steps.preview-build-artifact.outputs.download-path }}
```

</p>
</details>

If your project **does use runtime secrets**, then the deployment job can be fitted with an `environment` field that requires manual approval before each deployment.

Manual approval using [environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) needs to be setup at the repo level, as described in this [Melt UI PR](https://github.com/melt-ui/melt-ui/pull/899) under the _"Make the `Preview` environment protected"_ step.

<details><summary>Example: Preview Deployment <b>WITH RUNTIME SECRETS</b></summary>
<p>

```yaml
# build-preview.yml
name: Build Preview Deployment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  build-preview:
    environment: Preview # The name of the environment that requires manual approval before each deployment
    runs-on: ubuntu-latest
    name: Build Preview Site and Upload Build Artifact
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Run your install/build steps here
      # ...

      # Build example
      - name: Build site
        run: pnpm build
        env:
          # If you need environment variables that are **NOT secrets**,
          # apply them here during build using GH Action Variables
          SOME_ENV_VAR: ${{ vars.SOME_ENV_VAR }}

      # Uploads the build directory as a workflow artifact
      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: preview-build
          path: YOUR_BUILD_OUTPUT_DIRECTORY
```

```yaml
# deploy-preview.yml
name: Upload Preview Deployment
on:
  workflow_run:
    workflows: ['Build Preview Deployment']
    types:
      - completed

permissions:
  actions: read
  deployments: write
  contents: read
  pull-requests: write

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    name: Deploy Preview to Cloudflare Pages
    steps:
      # Downloads the build directory from the previous workflow
      - name: Download build artifact
        uses: actions/download-artifact@v4
        id: preview-build-artifact
        with:
          name: preview-build
          path: build
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}

      - name: Deploy to Cloudflare Pages
        uses: AdrianGonz97/refined-cf-pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          projectName: YOUR_PROJECT_NAME
          deploymentName: Preview
          directory: ${{ steps.preview-build-artifact.outputs.download-path }}
```

</p>
</details>

In the off chance that you need **build-time secrets** (which you should try to avoid if possible for previews), then you'll need to use the `pull_request_target` event _with_ manual approvals before each deployment.

> [!IMPORTANT]
> With this method, each PR needs to be reviewed thoroughly before deployment approval to ensure that secrets are not being exposed via malicious code. Use with discretion.

<details><summary>Example: Preview Deployment <b>WITH BUILD-TIME SECRETS</b></summary>
<p>

```yaml
name: Preview Deployment
on:
  pull_request_target:

jobs:
  deploy-preview:
    environment: Preview # The name of the environment that requires manual approval before each deployment
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write
    name: Deploy Preview to Cloudflare Pages
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          repository: ${{ github.event.pull_request.head.repo.full_name }}

      # Run your install/build steps here
      # ...

      # Build example
      - name: Build site
        run: pnpm build
        env:
          SOME_SECRET: ${{ secrets.SOME_SECRET }} # Uses some secret during build

      - name: Deploy to Cloudflare Pages
        uses: AdrianGonz97/refined-cf-pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          projectName: YOUR_PROJECT_NAME
          directory: YOUR_BUILD_OUTPUT_DIRECTORY
          deploymentName: Preview
```

</p>
</details>

### Specifying a branch

The branch name is used by Cloudflare Pages to determine if the deployment is production or preview. Read more about
[git branch build controls](https://developers.cloudflare.com/pages/platform/branch-build-controls/#branch-build-controls).

If you are in a Git workspace, Wrangler will automatically pull the branch information for you. You can override this
manually by adding the argument `branch: YOUR_BRANCH_NAME`.

### Specifying a working directory

By default Wrangler will run in the root package directory. If your app lives in a monorepo and you want to run Wrangler from its directory, add `workingDirectory: YOUR_PACKAGE_DIRECTORY`.

## Outputs

| Name          | Description                                           |
| ------------- | ----------------------------------------------------- |
| `id`          | The ID of the pages deployment                        |
| `url`         | The URL of the pages deployment                       |
| `alias`       | The alias, if it exists, otherwise the deployment URL |
| `environment` | The environment that was deployed to                  |
