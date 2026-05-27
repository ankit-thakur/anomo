const { Stack, Duration } = require('aws-cdk-lib');
const cdk = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');


class DdbStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    /** @type {string} */
    this.userPreferencesTableArn;

    const restaurantTable = new dynamodb.Table(this, 'RestaurantTable', {
      partitionKey: { name: 'restaurantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    new cdk.CfnOutput(this, 'RestaurantTableArn', {
        value: restaurantTable.tableArn,
        exportName: 'RestaurantTableExport',
    });

    new cdk.CfnOutput(this, 'RestaurantTableStreamArn', {
        value: restaurantTable.tableStreamArn,
        exportName: 'RestaurantTableStreamArnExport',
    });
    
    
    const menuItemsTable = new dynamodb.Table(this, 'MenuItemsTable', {
      partitionKey: { name: 'restaurantId', type: dynamodb.AttributeType.STRING },  // Partition key
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },               // Sort key (optional)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,                            // Billing mode
      // removalPolicy: cdk.RemovalPolicy.DESTROY,                                  // Removes table when stack is destroyed
    });

    // Export the table ARN to be used in other stacks
    new cdk.CfnOutput(this, 'MenuItemsTableArn', {
        value: menuItemsTable.tableArn,
        exportName: 'MenuItemsTableExport', // This name will be used to import the table in another stack
    });


    const connectionIdTable = new dynamodb.Table(this, 'ConnectionIdTable', {
      partitionKey: { name: 'connectionKey', type: dynamodb.AttributeType.STRING },  // Partition key
        //   sortKey: { name: 'itemName', type: dynamodb.AttributeType.STRING },           // Sort key (optional)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,                            // Billing mode
      // removalPolicy: cdk.RemovalPolicy.DESTROY,                                  // Removes table when stack is destroyed
    });

    const userPreferencesTable = new dynamodb.Table(this, 'UserPreferencesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Export the UserPreferences table ARN
    new cdk.CfnOutput(this, 'UserPreferencesTableArn', {
      value: userPreferencesTable.tableArn,
      exportName: 'UserPreferencesTableExport',
    });

    this.userPreferencesTableArn = userPreferencesTable.tableArn;

    // Export the table ARN to be used in other stacks
    new cdk.CfnOutput(this, 'ConnectionIdTableArn', {
        value: connectionIdTable.tableArn,
        exportName: 'ConnectionIdTableExport', // This name will be used to import the table in another stack
    });

    const emailListTable = new dynamodb.Table(this, 'EmailListTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },  // Partition key
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,                            // Billing mode
      // removalPolicy: cdk.RemovalPolicy.DESTROY,                                  // Removes table when stack is destroyed
    });

    // Export the table ARN to be used in other stacks
    new cdk.CfnOutput(this, 'EmailListTableArn', {
        value: emailListTable.tableArn,
        exportName: 'EmailListTableExport', // This name will be used to import the table in another stack
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Export the table ARN to be used in other stacks
    new cdk.CfnOutput(this, 'UsersTableArn', {
        value: usersTable.tableArn,
        exportName: 'UsersTableExport', // This name will be used to import the table in another stack
    });
  }
}

module.exports = { DdbStack }
