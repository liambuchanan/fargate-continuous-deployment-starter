import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as route53 from '@aws-cdk/aws-route53';

export interface DeploymentEnvironment {
  readonly stageName: string;
  readonly stackName: string;
  readonly domainName: string;
}

export interface PipelineStackProps extends cdk.StackProps {
  readonly githubRepoInfo: {
    readonly owner: string;
    readonly name: string;
    readonly branch: string;
  };
  readonly appName: string;
  readonly rootDomain: string;
  readonly deploymentEnvironments: DeploymentEnvironment[];
}

export class PipelineStack extends cdk.Stack {
  // public resources to be referenced in app stacks
  public readonly ecrRepo: ecr.Repository;
  public readonly hostedZone: route53.HostedZone;

  constructor(app: cdk.App, id: string, props: PipelineStackProps) {
    super(app, id, props);

    this.ecrRepo = new ecr.Repository(this, 'EcrRepo');
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: props.rootDomain,
    });

    const appBuild = new codebuild.PipelineProject(this, 'AppBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $IMAGE_SERVER',
              'export IMAGE_TAG=$CODEBUILD_RESOLVED_SOURCE_VERSION'
            ],
          },
          build: {
            commands: [
              'cd app',
              'docker build . -t $IMAGE_REPO:latest',
              'docker tag $IMAGE_REPO:latest $IMAGE_REPO:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'docker push $IMAGE_REPO:latest',
              'docker push $IMAGE_REPO:$IMAGE_TAG',
            ],
          },
        },
        env: {
          'exported-variables': [
            'IMAGE_TAG',
          ],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        environmentVariables: {
          IMAGE_SERVER: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: this.ecrRepo.repositoryUri.split('/')[0],
          },
          IMAGE_REPO: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: this.ecrRepo.repositoryUri,
          },
        },
        privileged: true, // requiried to run docker daemon
      },
    });
    appBuild.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      effect: iam.Effect.ALLOW,
      resources: ['*'],
    }));
    this.ecrRepo.grantPullPush(appBuild.role!);

    const sourceOutput = new codepipeline.Artifact();
    const appBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'App_Build',
      input: sourceOutput,
      project: appBuild,
    });
    const cdkBuildOutput = new codepipeline.Artifact('CdkBuildOutput');
    new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'Github_Source',
              branch: props.githubRepoInfo.branch,
              oauthToken: cdk.SecretValue.secretsManager(`${props.appName}GithubOauthToken`),
              output: sourceOutput,
              owner: props.githubRepoInfo.owner,
              repo: props.githubRepoInfo.name,
            }),
          ],
        },
        {
          stageName: 'Pipeline',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'CDK_Build',
              input: sourceOutput,
              outputs: [cdkBuildOutput],
              runOrder: 1,
              project: new codebuild.PipelineProject(this, 'CdkBuild', {
                buildSpec: codebuild.BuildSpec.fromObject({
                  version: '0.2',
                  phases: {
                    build: {
                      commands: [
                        'cd infra',
                        'npm install',
                        'npm run build',
                        'npm run cdk synth -- -o dist'
                      ],
                    },
                  },
                  artifacts: {
                    'base-directory': 'infra/dist',
                    files: [
                      ...props.deploymentEnvironments.map(denv => `${denv.stackName}.template.json`),
                      `${props.appName}PipelineStack.template.json`,
                    ],
                  },
                }),
                environment: {
                  buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
                },
              }),
            }),
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Pipeline_CFN_Deploy',
              adminPermissions: true,
              runOrder: 2,
              stackName: `${props.appName}PipelineStack`,
              templatePath: cdkBuildOutput.atPath(`${props.appName}PipelineStack.template.json`),
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            appBuildAction,
          ]
        },
        ...props.deploymentEnvironments.map(denv => ({
          stageName: `Deploy${de.stageName}`,
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: `${denv.stageName}_CFN_Deploy`,
              adminPermissions: true,
              runOrder: 1,
              stackName: denv.stackName,
              templatePath: cdkBuildOutput.atPath(`${denv.stackName}.template.json`),
              parameterOverrides: {
                IMAGETAG: appBuildAction.variable('IMAGE_TAG'),
              },
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: `${denv.stageName}_Integ_Test`,
              input: sourceOutput,
              runOrder: 2,
              type: codepipeline_actions.CodeBuildActionType.TEST,
              project: new codebuild.PipelineProject(this, `${denv.stageName}IntegTest`, {
                buildSpec: codebuild.BuildSpec.fromObject({
                  version: '0.2',
                  phases: {
                    build: {
                      commands: [
                        'cd app-integ-test',
                        'npm install',
                        'npm run test',
                      ],
                    },
                  },
                }),
                environment: {
                  buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
                  environmentVariables: {
                    HOST: {
                      type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                      value: `https://${denv.domainName}`,
                    },
                  },
                },
              }),
            }),
          ],
        })),
      ],
    });
  }
}
