import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_codepipeline as codepipeline } from "aws-cdk-lib";
import { aws_codepipeline_actions as codepipelineActions } from "aws-cdk-lib";
import { aws_ecr as ecr } from "aws-cdk-lib";
import { aws_codebuild as codebuild } from "aws-cdk-lib";
import { aws_iam as iam } from "aws-cdk-lib";
import { aws_ec2 as ec2 } from "aws-cdk-lib";
import {
  CODESTAR_CONNECTION_ARN,
  SOURCE_REPO_BRANCH,
  SOURCE_REPO_OWNER,
  EKS_CLUSTER_NAME,
  EKS_CLUSTER_ARN,
  VPC_LOOKUP_TAGS,
} from "./config";

interface PipelineStackProps extends cdk.StackProps {
  sourceRepo: string;
  deployEnvironmentVariables: { [key: string]: codebuild.BuildEnvironmentVariable };
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { tags: VPC_LOOKUP_TAGS });

    const ecrRepository = new ecr.Repository(this, "ECRRepository", {
      repositoryName: props.sourceRepo,
    });

    const ecrAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: [
        "ecr:GetAuthorizationToken",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:BatchDeleteImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
      ],
    });

    const sourceArtifact = new codepipeline.Artifact("SourceArtifact");

    const sourceAction = new codepipelineActions.CodeStarConnectionsSourceAction({
      actionName: "Source",
      connectionArn: CODESTAR_CONNECTION_ARN,
      owner: SOURCE_REPO_OWNER,
      repo: props.sourceRepo,
      branch: SOURCE_REPO_BRANCH,
      output: sourceArtifact,
    });

    const ecrBuildProject = new codebuild.PipelineProject(this, "ECRBuild", {
      buildSpec: codebuild.BuildSpec.fromSourceFilename("files/build.yaml"),
      environment: {
        privileged: true,
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: ecrRepository.repositoryUri,
        },
        ECR_REGISTRY: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: ecrRepository.repositoryUri.split("/")[0],
        },
        ECR_REPOSITORY: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: ecrRepository.repositoryUri.split("/")[1],
        },
      },
    });

    ecrBuildProject.addToRolePolicy(ecrAccessPolicy);

    const buildAction = new codepipelineActions.CodeBuildAction({
      actionName: "Build",
      project: ecrBuildProject,
      input: sourceArtifact,
    });

    const eksDeployPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [EKS_CLUSTER_ARN],
      actions: ["eks:DescribeCluster"],
    });

    const eksDeployProject = new codebuild.PipelineProject(this, "EKSDeploy", {
      buildSpec: codebuild.BuildSpec.fromSourceFilename("files/deploy.yaml"),
      vpc: vpc,
      environment: {
        privileged: true,
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: ecrRepository.repositoryUri,
        },
        EKS_CLUSTER_NAME: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: EKS_CLUSTER_NAME,
        },
        ...props.deployEnvironmentVariables,
      },
    });

    eksDeployProject.addToRolePolicy(eksDeployPolicy);

    const deployAction = new codepipelineActions.CodeBuildAction({
      actionName: "Deploy",
      project: eksDeployProject,
      input: sourceArtifact,
    });

    new codepipeline.Pipeline(this, "Pipeline", {
      crossAccountKeys: false,
      stages: [
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        {
          stageName: "Build",
          actions: [buildAction],
        },
        {
          stageName: "Deploy",
          actions: [deployAction],
        },
      ],
    });
  }
}

// export class BackendPipelineStack extends cdk.Stack {
//     constructor(scope: Construct, id: string, props?: cdk.StackProps) {
//         super(scope, id, props);

//         // The code that defines your stack goes here

//         // example resource
//         // const queue = new sqs.Queue(this, 'TaskListCdkQueue', {
//         //   visibilityTimeout: cdk.Duration.seconds(300)
//         // });

//         // const frontendEcrRepository = new ecr.Repository(this, 'FrontendECRRepository', {
//         //     repositoryName: 'task-list-frontend',
//         // });

//         const ecrRepository = new ecr.Repository(this, 'ECRRepository', {
//             repositoryName: 'task-list-api',
//         });

//         const sourceArtifact = new codepipeline.Artifact('SourceArtifact')

//         const sourceAction = new codepipelineActions.CodeStarConnectionsSourceAction({
//             actionName: 'BackendSource',
//             connectionArn: CODESTAR_CONNECTION_ARN,
//             owner: SOURCE_REPO_OWNER,
//             repo: 'task-list-api',
//             branch: SOURCE_REPO_BRANCH,
//             output: sourceArtifact
//         });

//         const buildProject = new codebuild.PipelineProject(this, 'Build', {
//             buildSpec: codebuild.BuildSpec.fromSourceFilename("deploy/build.yaml"),
//             environment: {
//                 privileged: true,
//                 buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
//                 computeType: codebuild.ComputeType.SMALL
//             },
//             environmentVariables: {
//                 ECR_REPOSITORY_URI: {
//                     type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
//                     value: ecrRepository.repositoryUri,
//                 },
//                 ECR_REGISTRY: {
//                     type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
//                     value: ecrRepository.repositoryUri.split('/')[0],
//                 },
//                 ECR_REPOSITORY: {
//                     type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
//                     value: ecrRepository.repositoryUri.split('/')[1],
//                 },
//             }
//         });

//         const buildAction = new codepipelineActions.CodeBuildAction({
//             actionName: 'Build',
//             project: buildProject,
//             input: sourceArtifact
//         })

//         const deployProject = new codebuild.PipelineProject(this, 'Deploy', {
//             buildSpec: codebuild.BuildSpec.fromSourceFilename("deploy/deploy.yaml"),
//             environment: {
//                 privileged: true,
//                 buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
//                 computeType: codebuild.ComputeType.SMALL
//             }
//         });

//         const deployAction = new codepipelineActions.CodeBuildAction({
//             actionName: 'Deploy',
//             project: deployProject,
//             input: sourceArtifact
//         })

//         new codepipeline.Pipeline(this, 'Pipeline', {
//             crossAccountKeys: false,
//             stages: [
//                 {
//                     stageName: 'Source',
//                     actions: [sourceAction]
//                 },
//                 {
//                     stageName: 'Build',
//                     actions: [buildAction]
//                 },
//                 {
//                     stageName: 'Deploy',
//                     actions: [deployAction]
//                 }
//             ]
//         });
//     }
// }
