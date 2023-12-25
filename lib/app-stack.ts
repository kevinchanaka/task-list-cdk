// Stack to create various application specific AWS resources
// TODO: Add cognito user pool here once ready

import * as cdk from "aws-cdk-lib";
import { aws_iam as iam } from "aws-cdk-lib";
import { aws_rds as rds } from "aws-cdk-lib";
import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { aws_secretsmanager as secretsmanager } from "aws-cdk-lib";
import { aws_codebuild as codebuild } from "aws-cdk-lib";
import {
  EKS_OIDC_PROVIDER_ARN,
  EKS_CLUSTER_NAME,
  DATABASE_NAME,
  DATABASE_USER,
  APP_PORT,
  VPC_LOOKUP_TAGS,
} from "./config";

export class AppStack extends cdk.Stack {
  public readonly deployVariables: { [key: string]: codebuild.BuildEnvironmentVariable };

  constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { tags: VPC_LOOKUP_TAGS });

    const databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    databaseSecurityGroup.addIngressRule(ec2.Peer.ipv4("192.168.0.0/16"), ec2.Port.tcp(3306));

    const databaseInstance = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      securityGroups: [databaseSecurityGroup],
      allocatedStorage: 5,
    });

    const accessTokenSecret = new secretsmanager.Secret(this, "AccessTokenSecret", {
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 50,
      },
    });

    const refreshTokenSecret = new secretsmanager.Secret(this, "RefreshTokenSecret", {
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 50,
      },
    });

    const databaseUserCredentials = new secretsmanager.Secret(this, "DatabaseUserCredentials", {
      generateSecretString: {
        excludePunctuation: true,
        generateStringKey: "password",
        secretStringTemplate: JSON.stringify({ username: DATABASE_USER }),
      },
    });

    const taskListApiPolicyStatement = new iam.PolicyStatement({
      actions: ["cognito-idp:AdminInitiateAuth", "cognito-idp:AdminGetUser"],
      effect: iam.Effect.ALLOW,
      resources: ["*"],
    });

    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "OidcProvider",
      EKS_OIDC_PROVIDER_ARN,
    );

    const provider = EKS_OIDC_PROVIDER_ARN.slice(EKS_OIDC_PROVIDER_ARN.indexOf("/") + 1);

    const taskListApiRole = new iam.Role(this, "TaskListApiRole", {
      assumedBy: new iam.OpenIdConnectPrincipal(oidcProvider, {
        StringEquals: {
          [provider + ":sub"]: "system:serviceaccount:task-list:task-list-api",
          [provider + ":aud"]: "sts.amazonaws.com",
        },
      }),
      inlinePolicies: {
        taskListApiPolicy: new iam.PolicyDocument({
          statements: [taskListApiPolicyStatement],
        }),
      },
    });

    this.deployVariables = {
      NODE_ENV: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: "production",
      },
      PORT: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: APP_PORT,
      },
      DB_ADMIN_USER: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseInstance.secret?.secretArn + ":username",
      },
      DB_ADMIN_PASSWORD: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseInstance.secret?.secretArn + ":password",
      },
      DB_USER: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseUserCredentials.secretArn + ":username",
      },
      DB_PASSWORD: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseUserCredentials.secretArn + ":password",
      },
      DB_NAME: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: DATABASE_NAME,
      },
      DB_HOST: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseInstance.secret?.secretArn + ":host",
      },
      DB_PORT: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: databaseInstance.secret?.secretArn + ":port",
      },
      ACCESS_TOKEN_SECRET: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: accessTokenSecret.secretArn,
      },
      REFRESH_TOKEN_SECRET: {
        type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
        value: refreshTokenSecret.secretArn,
      },
      APP_IAM_ROLE_ARN: {
        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        value: taskListApiRole.roleArn,
      },
    };
  }
}
