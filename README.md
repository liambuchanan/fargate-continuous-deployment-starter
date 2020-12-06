## Fargate continuous deployment starter

Get up and running with a continuous deployment pipeline for a fargate application.

### Features

* Infrastructure-as-code using AWS CDK
* Self modifying pipeline (N.B. CodePipeline doesn't handle self-modifcation particularly gracefully. Change sets that affect the pipeline CFN stack will result in a pipeline failure with no failed stages. Click "Release change" in the pipeline kick off another build.)
* Staging and production environments
* Integration tests
* HTTPS/TLS

### Prerequisites

Make sure you have these tools installed locally:

* [aws-cdk](https://www.npmjs.com/package/aws-cdk)
* [aws-cli](https://aws.amazon.com/cli)
* [docker](https://docs.docker.com/get-docker)
* [node/npm](https://nodejs.org/en/download)

### Getting started

* [Make a copy of this repository](./generate)
* [Create a github personal access token](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token)
* `aws configure` to ensure your default profile can be used to deploy the pipeline to the appropriate AWS account and region
* [`./bootstrap.sh`](./bootstrap.sh) to create a pipeline in your AWS account
* [Update your domain registrar to reference the nameservers in the hosted zone provisioned](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/GetInfoAboutHostedZone.html)
* `git add infra/bin/config.json`, push to your repo, and wait for your app to be deployed


### Demo

Once you have completed the steps outlined above you should have a pipeline in your aws account similar to the one shown below.

![example pipeline](https://user-images.githubusercontent.com/2258401/101295210-3706ce80-37ea-11eb-9862-e96850feaee3.png)
