# Cloudflare Pages GitHub Action

> This is an opinionated fork of the official [Cloudflare Pages Action](https://github.com/cloudflare/pages-action).

> [!WARNING]
> This action entirely replaces the Cloudflare Pages GitHub integration. You should [disable the automatic builds](#disabling-the-cloudflare-pages-github-app-integration) made by Cloudflare for the repository you are applying this action to.

GitHub Action for creating Cloudflare Pages deployments, using the [Direct Upload](https://developers.cloudflare.com/pages/platform/direct-upload/) feature with [Wrangler](https://developers.cloudflare.com/pages/platform/direct-upload/#wrangler-cli).

## Advantages over the official solutions

- ✅ Generated build summaries
- ✅ Deploy multiple sites from a single monorepo
- ✅ Preview builds of PRs from forked repositories, [a known issue](https://developers.cloudflare.com/pages/platform/known-issues/#builds-and-deployment) with official solutions
- ✅ Github Deployments on PRs from forks

## Usage

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
        uses: AdrianGonz97/cf-pages-action@v1
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

To find your account ID, log in to the Cloudflare dashboard > select your zone in Account Home > find your account ID in Overview under **API** on the right-side menu. If you have not added a zone, add one by selecting **Add site** . You can purchase a domain from [Cloudflare’s registrar](https://developers.cloudflare.com/registrar/).

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

More information can be found on the [guide for making Direct Upload deployments with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/#use-github-actions).

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
