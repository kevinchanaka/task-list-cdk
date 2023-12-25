export const ENV = { account: "436501147244", region: "ap-southeast-2" };

export const CODESTAR_CONNECTION_ARN =
  "arn:aws:codestar-connections:" +
  "ap-southeast-2:436501147244:connection/0e367578-3062-48ba-9a9a-b1ce675b7720";
export const SOURCE_REPO_OWNER = "kevinchanaka";
export const SOURCE_REPO_BRANCH = "main";

export const DATABASE_NAME = "tasklist";
export const DATABASE_USER = "task-list-user";
export const APP_PORT = 3000;

export const VPC_LOOKUP_TAGS = {
  "aws:cloudformation:stack-name": "eksctl-prod-cluster",
};

export const EKS_CLUSTER_NAME = "prod";
export const EKS_CLUSTER_ARN = "arn:aws:eks:ap-southeast-2:436501147244:cluster/prod";
export const EKS_OIDC_PROVIDER_ARN =
  "arn:aws:iam::436501147244:oidc-provider" +
  "/oidc.eks.ap-southeast-2.amazonaws.com/id/5B2AE7525B2B4B5835ACE1A1F9BD8EAF";
