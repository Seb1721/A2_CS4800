import { MongoClient, ServerApiVersion } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME || "carkeeper";
const DATABASE_CONFIG_ERROR = "Database configuration is missing.";
const DATABASE_UNAVAILABLE_ERROR = "Database unavailable.";

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
    throw new Error(DATABASE_CONFIG_ERROR);
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    },
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    maxPoolSize: 10
  });
  const clientPromise = client.connect().catch(async (error: unknown) => {
    global.__mongoClientPromise__ = undefined;
    console.error("MongoDB connection failed.", error);
    await client.close().catch(() => undefined);
    throw new Error(DATABASE_UNAVAILABLE_ERROR, { cause: error });
  });
  global.__mongoClientPromise__ = clientPromise;

  return clientPromise;
}

export async function getDatabase() {
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function pingDatabase() {
  const db = await getDatabase();
  await db.command({ ping: 1 });
}

export function isDatabaseUnavailableError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === DATABASE_CONFIG_ERROR || error.message === DATABASE_UNAVAILABLE_ERROR)
  );
}
