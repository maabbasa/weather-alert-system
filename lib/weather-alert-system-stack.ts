import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as path from 'path';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

export class WeatherAlertSystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: { region: 'us-east-1' }
    });

    // Buckets
    const rawBucket = new s3.Bucket(this, 'RawWeatherData');
    const starBucket = new s3.Bucket(this, 'StarSchemaData');

    // DynamoDB
    const table = new dynamodb.Table(this, 'Subscribers', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: cdk.Duration.seconds(30),
      environment: {
        RAW_BUCKET_NAME: rawBucket.bucketName,
        TABLE_NAME: table.tableName,
        SENDER_EMAIL: 'mohamed.abbas@buildwithabbas.com',
      },
    };

    // Lambda: weather-fetcher
    const weatherFetcher = new lambda.Function(this, 'WeatherFetcher', {
      ...commonLambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/weather-fetcher')),
    });
    rawBucket.grantPut(weatherFetcher);

    // Lambda: daily-alert
    const dailyAlert = new lambda.Function(this, 'DailyAlert', {
      ...commonLambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/daily-alert')),
    });

    // Lambda: severe-alert
    const severeAlert = new lambda.Function(this, 'SevereAlert', {
      ...commonLambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/severe-alert')),
    });

    // Lambda: subscribe
    const subscribe = new lambda.Function(this, 'SubscribeUser', {
      ...commonLambdaProps,
      handler: 'subscribe.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/subscription')),
    });

    // Lambda: unsubscribe
    const unsubscribe = new lambda.Function(this, 'UnsubscribeUser', {
      ...commonLambdaProps,
      handler: 'unsubscribe.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/subscription')),
    });

    // Permissions
    rawBucket.grantReadWrite(weatherFetcher);
    table.grantReadWriteData(subscribe);
    table.grantReadWriteData(unsubscribe);
    table.grantReadData(dailyAlert);
    table.grantReadData(severeAlert);

    [dailyAlert, severeAlert].forEach(fn => {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }));
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'WeatherApi');
    const subscribeResource = api.root.addResource('subscribe');
    const unsubscribeResource = api.root.addResource('unsubscribe');
    subscribeResource.addMethod('POST', new apigateway.LambdaIntegration(subscribe));
    unsubscribeResource.addMethod('POST', new apigateway.LambdaIntegration(unsubscribe));

    // Schedules
    new events.Rule(this, 'DailyAlertSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new targets.LambdaFunction(dailyAlert)]
    });

    new events.Rule(this, 'SevereAlertSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(severeAlert)]
    });

    new events.Rule(this, 'WeatherFetcherSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(weatherFetcher)]
    });

    // Glue Job Role
    const glueJobRole = new iam.Role(this, 'GlueJobRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ]
    });
    rawBucket.grantRead(glueJobRole);
    starBucket.grantReadWrite(glueJobRole);
    const glueScriptAsset = new s3assets.Asset(this, 'GlueScriptAsset', {
      path: path.join(__dirname, '../glue/scripts/transform_weather.py'),
    });
    glueScriptAsset.grantRead(glueJobRole);
    // Glue Job
    new glue.CfnJob(this, 'WeatherStarSchemaJob', {
      name: 'weather-star-schema-job',
      role: glueJobRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: glueScriptAsset.s3ObjectUrl, // 🔥 This points to uploaded asset
      },
      glueVersion: '4.0',
      executionProperty: { maxConcurrentRuns: 1 },
      maxRetries: 1,
      timeout: 10,
      numberOfWorkers: 2,
      workerType: 'G.1X',
    });
    new events.Rule(this, 'HourlyGlueJobSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [
        new targets.AwsApi({
          service: 'Glue',
          action: 'startJobRun',
          parameters: {
            JobName: 'weather-star-schema-job',
          },
          policyStatement: new iam.PolicyStatement({
            actions: ['glue:StartJobRun'],
            resources: ['*'], // Or restrict to the specific job ARN
          }),
        }),
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'RawDataBucketName', { value: rawBucket.bucketName });
    new cdk.CfnOutput(this, 'StarSchemaBucketName', { value: starBucket.bucketName });
    new cdk.CfnOutput(this, 'APIEndpoint', { value: api.url });
  }
}
