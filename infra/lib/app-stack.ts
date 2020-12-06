import * as cdk from '@aws-cdk/core';
import * as certificatemanager from '@aws-cdk/aws-certificatemanager';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import * as route53 from '@aws-cdk/aws-route53';

const CONTAINER_PORT = 8000;

export interface AppStackProps extends cdk.StackProps {
  readonly ecrRepo: ecr.Repository;
  readonly domainName: string;
  readonly hostedZone: route53.HostedZone;
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const imageTag = new cdk.CfnParameter(this, 'IMAGETAG');
    const image = ecs.ContainerImage.fromEcrRepository(props.ecrRepo, imageTag.valueAsString);
    new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      taskImageOptions: {
        image,
        containerPort: CONTAINER_PORT,
        environment: {
          PORT: CONTAINER_PORT.toString(),
        },
        secrets: {},
      },
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      assignPublicIp: false,
      publicLoadBalancer: true,
      domainName: props.domainName,
      domainZone: props.hostedZone,
      certificate: new certificatemanager.Certificate(this, 'TlsCertificate', {
        domainName: props.domainName
      }),
      redirectHTTP: true,
    });
  }
}
