const cdk = require('aws-cdk-lib');
const { Stack, StackProps } = require('aws-cdk-lib');
const { WebSocketApi, WebSocketStage } = require('@aws-cdk/aws-apigatewayv2-alpha');
const { WebSocketLambdaIntegration } = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require('path');


class WebSocketApiStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // Import the Lambda Layer from another stack using its exported ARN
        const importedConnectionIdTable = dynamodb.Table.fromTableArn(
            this,
            'ConnectionIdTable',
            cdk.Fn.importValue('ConnectionIdTableExport') // Import by export name
        );

        // Lambda function for handling WebSocket connection lifecycle
        const connectionHandler = new lambda.Function(this, 'ConnectionHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            code: lambda.Code.fromAsset(path.resolve(__dirname, '../../MenuAnalysisAppServer/lambdas/websocket')),
            handler: 'connectionHandler.connectionHandler',
        });

        // Create WebSocket API before messageHandler so we can reference its ID in the IAM policy
        const webSocketApi = new WebSocketApi(this, 'WebSocketApi', {
            connectRouteOptions: { integration: new WebSocketLambdaIntegration('ConnectIntegration', connectionHandler) },
            disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('DisconnectIntegration', connectionHandler) },
        });

        // WebSocket API stage
        const webSocketStage = new WebSocketStage(this, 'ProdStage', {
            webSocketApi,
            stageName: 'prod',
            autoDeploy: true,
        });

        // Lambda function for WebSocket message handling
        const messageHandler = new lambda.Function(this, 'MessageHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            code: lambda.Code.fromAsset(path.resolve(__dirname, '../../MenuAnalysisAppServer/lambdas/websocket')),
            handler: 'message_handler.message_handler',
            environment: {
                CONNECTIONS_TABLE:  importedConnectionIdTable.tableName,
                WEBSOCKET_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/prod/`,
            },
        });

        messageHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/prod/POST/@connections/*`],
        }));

        webSocketApi.addRoute('$default', {
            integration: new WebSocketLambdaIntegration('MessageIntegration', messageHandler),
        });

        importedConnectionIdTable.grantReadWriteData(messageHandler);
    }
}

module.exports = { WebSocketApiStack }
