import json
import boto3

table = boto3.resource('dynamodb').Table("Subscribers")

def handler(event, context):
    body = json.loads(event["body"])
    email = body.get("email")
    token = body.get("token")

    record = table.get_item(Key={"email": email}).get("Item")

    if not record or record["unsubscribe_token"] != token:
        return {"statusCode": 403, "body": "Invalid token"}

    table.delete_item(Key={"email": email})

    return {"statusCode": 200, "body": "Unsubscribed successfully"}
