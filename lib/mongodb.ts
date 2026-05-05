import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is required.");
}

const dbName = process.env.MONGODB_DB_NAME || "car_info";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise__: Promise<MongoClient> | undefined;
}

const clientPromise =
  global.__mongoClientPromise__ ||
  new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  }).connect();

if (process.env.NODE_ENV !== "production") {
  global.__mongoClientPromise__ = clientPromise;
}

export async function getDatabase() {
  const client = await clientPromise;
  return client.db(dbName);
}
