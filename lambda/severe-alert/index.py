import boto3
import json
import os

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
table_name = os.environ.get("TABLE_NAME", "Subscribers")


def is_severe(weather_data):
    wind = weather_data.get("wind_speed", 0)
    return wind > 60


def handler(event, context):
    # Simulated severe weather alert (in real case fetch from API/S3)
    alert = {
        "location": "Berlin",
        "wind_speed": 75,
        "status": "Severe Storm"
    }

    if not is_severe(alert):
        return {"statusCode": 200, "body": "No severe alerts"}

    table = dynamodb.Table(table_name)
    subs = table.scan().get("Items", [])

    for sub in subs:
        email = sub["email"]
        ses.send_email(
            Source=os.environ["SENDER_EMAIL"],
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "🚨 Severe Weather Alert!"},
                "Body": {
                    "Text": {"Data": f"Severe alert: {alert['status']} in {alert['location']}."}
                }
            }
        )

    return {"statusCode": 200, "body": f"Sent alert to {len(subs)} subscribers"}
