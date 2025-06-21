import json
import boto3
import uuid
import urllib.request

table = boto3.resource('dynamodb').Table("Subscribers")

def handler(event, context):
    body = json.loads(event["body"])
    email = body.get("email")

    # Get country via IP
    ip = event["requestContext"]["identity"]["sourceIp"]
    url = f"http://ip-api.com/json/{ip}"
    res = urllib.request.urlopen(url)
    loc_data = json.loads(res.read())
    country = loc_data.get("country", "Unknown")

    token = str(uuid.uuid4())

    table.put_item(Item={
        "email": email,
        "country": country,
        "unsubscribe_token": token
    })

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Subscribed successfully.",
            "unsubscribe_token": token
        })
    }
