import os
import json
import boto3

def get_mongodb_uri():
    local_uri = os.getenv("MONGODB_URI")
    if local_uri:
        return local_uri

    secret_name = "prod/carkeeper/mongodb"
    region_name = "us-west-2"

    client = boto3.client("secretsmanager", region_name=region_name)
    response = client.get_secret_value(SecretId=secret_name)
    secret = json.loads(response["SecretString"])
    return secret["MONGODB_URI"]