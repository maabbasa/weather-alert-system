import boto3
import os

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
table_name = os.environ.get("TABLE_NAME", "Subscribers")

def handler(event, context):
    table = dynamodb.Table(table_name)
    scan = table.scan()
    subscribers = scan.get("Items", [])

    for sub in subscribers:
        email = sub["email"]
        ses.send_email(
            Source=os.environ["SENDER_EMAIL"],
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "Daily Weather Update"},
                "Body": {
                    "Text": {"Data": "Your daily weather summary goes here."}
                }
            }
        )

    return {"statusCode": 200, "body": f"Sent {len(subscribers)} emails"}
