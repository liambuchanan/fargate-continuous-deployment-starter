#!/bin/sh
set -xeuo pipefail
cd $(dirname $0)

echo "Ensure your default AWS profile is referencing the appropriate AWS account, region, and role!"
aws configure
aws sts get-caller-identity

read -p "APP_NAME: " APP_NAME
read -p "ROOT_DOMAIN: " ROOT_DOMAIN
read -p "GITHUB_ACCOUNT_NAME: " GITHUB_ACCOUNT_NAME
read -p "GITHUB_REPO_NAME: " GITHUB_REPO_NAME
read -p "GITHUB_BRANCH_NAME: " GITHUB_BRANCH_NAME
read -p "GITHUB_OAUTH_TOKEN: " GITHUB_OAUTH_TOKEN

cd infra
aws secretsmanager create-secret --name "${APP_NAME}GithubOauthToken" --secret-string "${GITHUB_OAUTH_TOKEN}"
cat << EOF > bin/config.json
{
  "APP_NAME": "${APP_NAME}",
  "ROOT_DOMAIN": "${ROOT_DOMAIN}",
  "GITHUB_ACCOUNT_NAME": "${GITHUB_ACCOUNT_NAME}",
  "GITHUB_REPO_NAME": "${GITHUB_REPO_NAME}",
  "GITHUB_BRANCH_NAME": "${GITHUB_BRANCH_NAME}"
}
EOF
npm install
npm run build
cdk bootstrap
cdk deploy "${APP_NAME}PipelineStack"

echo "Be sure to update the nameservers at your domain registrar to reference those in the hosted zone provisioned."
