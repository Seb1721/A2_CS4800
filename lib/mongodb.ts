import { MongoClient, ServerApiVersion } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME || "car_info";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise__: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  if (global.__mongoClientPromise__) {
    return global.__mongoClientPromise__;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Set it in your local environment or Amplify branch environment variables."
    );
  }

  const clientPromise = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  }).connect();

  if (process.env.NODE_ENV !== "production") {
    global.__mongoClientPromise__ = clientPromise;
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getClientPromise();
  return client.db(dbName);
}
