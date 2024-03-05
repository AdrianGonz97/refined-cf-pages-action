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
1. [Generate an API token](#generate-an-api-token).
1. Add the Cloudflare account ID and API token [as secrets to your GitHub repository](#add-cloudflare-credentials-to-github-secrets).
1. Create a `.github/workflows/publish.yml` file in your repository:

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

1. Replace `YOUR_PROJECT_NAME` and `YOUR_BUILD_OUTPUT_DIRECTORY` with the appropriate values to your Pages project.

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

Enabling PR previews from forks requires the use of the [`pull_request_target`](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request_target) event in the workflow, which has security concerns around exposing secrets that need to be considered before implementing it into your project.

If your site _does not_ use/have any secrets during **the build step** or in your **preview environment on Cloudflare**, then it should be fine to use as-is. We use this method in [Formsnap](https://github.com/svecosystem/formsnap) and its implementation can be found in this [workflow file](https://github.com/svecosystem/formsnap/blob/main/.github/workflows/docs-preview.yml).

<details><summary>Example: Preview Deployment with <b>NO SECRETS</b></summary>
<p>

```yaml
name: Preview Deployment
on:
  pull_request_target:

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write
    name: Deploy Preview to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          repository: ${{ github.event.pull_request.head.repo.full_name }}

      # Run your install/build steps here

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

If your project _does use secrets_, then the deployment job can be fitted with an `environment` field that requires manual approval before each deployment (like it does in the [Melt UI workflow](https://github.com/melt-ui/melt-ui/blob/develop/.github/workflows/preview.yml)).

Manual approval using [environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) needs to be setup at the repo level, as described in [this Melt UI PR](https://github.com/melt-ui/melt-ui/pull/899) under the _"Make the `Preview` environment protected"_ step.

<details><summary>Example: Preview Deployment <b>WITH SECRETS</b></summary>
<p>

```yaml
name: Preview Deployment
on:
  pull_request_target:

jobs:
  deploy-preview:
    environment: Preview # Requires manual approval before each deployment!
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write
    name: Deploy Preview to Cloudflare Pages
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          repository: ${{ github.event.pull_request.head.repo.full_name }}

      # Run your install/build steps here

      - name: Build site
        run: pnpm build
        env:
          SOME_SECRET: 'foo' # Uses some secret during build!

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
