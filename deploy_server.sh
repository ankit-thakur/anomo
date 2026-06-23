#!/bin/bash

# Package Lambda function
cd MenuAnalysisAppServer/lambda_function
zip -r ../lambda_function.zip .
cd ..

# Deploy with CDK
cd MenuAnalysisAppCdk
npm install
cdk deploy
