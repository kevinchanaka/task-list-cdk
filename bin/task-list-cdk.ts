#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PipelineStack } from "../lib/pipeline-stack";
import { AppStack } from "../lib/app-stack";
import { ENV } from "../lib/config";

const app = new cdk.App();

const appStack = new AppStack(app, "AppStack", {
  env: ENV,
});

new PipelineStack(app, "BackendPipeline", {
  env: ENV,
  sourceRepo: "task-list-api",
  deployEnvironmentVariables: appStack.deployVariables,
});

new PipelineStack(app, "FrontendPipeline", {
  env: ENV,
  sourceRepo: "task-list-frontend",
  deployEnvironmentVariables: {},
});
