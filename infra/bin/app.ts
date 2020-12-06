#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as config from './config.json';
import { AppStack } from '../lib/app-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const DEPLOYMENT_ENVIRONMENTS = [
    {
        stageName: 'Staging',
        stackName: `${config.APP_NAME}StagingStack`,
        domainName: `staging.${config.ROOT_DOMAIN}`,
    },
    {
        stageName: 'Production',
        stackName: `${config.APP_NAME}ProductionStack`,
        domainName: config.ROOT_DOMAIN,
    }
]

const app = new cdk.App();
const pipelineStack = new PipelineStack(app, `${config.APP_NAME}PipelineStack`, {
    githubRepoInfo: {
        owner: config.GITHUB_ACCOUNT_NAME,
        name: config.GITHUB_REPO_NAME,
        branch: config.GITHUB_BRANCH_NAME,
    },
    appName: config.APP_NAME,
    rootDomain: config.ROOT_DOMAIN,
    deploymentEnvironments: DEPLOYMENT_ENVIRONMENTS,
});
DEPLOYMENT_ENVIRONMENTS.forEach(deploymentEnvironment =>
    new AppStack(app, deploymentEnvironment.stackName, {
        ecrRepo: pipelineStack.ecrRepo,
        domainName: deploymentEnvironment.domainName,
        hostedZone: pipelineStack.hostedZone,
    })
);
