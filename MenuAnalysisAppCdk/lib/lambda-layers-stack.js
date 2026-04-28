const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const { Stack, Duration } = require('aws-cdk-lib');
const path = require('path');


class LambdaLayersStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const boto3Layer = new lambda.LayerVersion(this, 'Boto3Layer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/boto3layer3')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
            description: 'A Lambda Layer that contains boto3 dependencies for the Lambdas',
        });

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'Boto3LayerVersionArn', {
            value: boto3Layer.layerVersionArn,
            exportName: 'Boto3LayerVersionArn', // This name will be used to import the layer in another stack
        });

        // requests module lambda layer
        const requestsLayer = new lambda.LayerVersion(this, 'RequestsLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/requests_layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
        });  

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'RequestsLayerVersionArn', {
            value: requestsLayer.layerVersionArn,
            exportName: 'RequestsLayerVersionArn', // This name will be used to import the layer in another stack
        });

        // dotenv module lambda layer
        const dotenvLayer = new lambda.LayerVersion(this, 'dotenv_layer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/dotenv_layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
        });  

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'DotenvLayerVersionArn', {
            value: dotenvLayer.layerVersionArn,
            exportName: 'DotenvLayerVersionArn', // This name will be used to import the layer in another stack
        });

        // OpenAI module lambda layer
        const openAiLayer = new lambda.LayerVersion(this, 'OpenAiLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/openai_layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
        });  

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'OpenAiLayerVersionArn', {
            value: openAiLayer.layerVersionArn,
            exportName: 'OpenAiLayerVersionArn', // This name will be used to import the layer in another stack
        });

        // PdfReader module lambda layer
        const pdfReaderLayer = new lambda.LayerVersion(this, 'PdfReaderLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/pdfReader-layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_8, lambda.Runtime.PYTHON_3_12],
        });  

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'PdfReaderLayerVersionArn', {
            value: pdfReaderLayer.layerVersionArn,
            exportName: 'PdfReaderLayerVersionArn', // This name will be used to import the layer in another stack
        });

        const openSearchLayer = new lambda.LayerVersion(this, 'OpenSearchLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/open_search_layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
            description: 'OpenSearch lambda layer',
        });

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'OpenSearchLayerVersionArn', {
            value: openSearchLayer.layerVersionArn,
            exportName: 'OpenSearchLayerVersionArn', // This name will be used to import the layer in another stack
        });

        const bs4Layer = new lambda.LayerVersion(this, 'BS4Layer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/bs4_layer')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
            description: 'Lambda layer for BeautifulSoup4',
        });

        // Export the Layer ARN to be used in other stacks
        new cdk.CfnOutput(this, 'BS4LayerVersionArn', {
            value: bs4Layer.layerVersionArn,
            exportName: 'BS4LayerVersionArn', // This name will be used to import the layer in another stack
        });

        // strands-agents layer is referenced directly by public ARN in step-function-lambda-stack.js
        // No custom layer needed — see STRANDS_LAYER_VERSION in that stack.
    }
}

module.exports = { LambdaLayersStack }