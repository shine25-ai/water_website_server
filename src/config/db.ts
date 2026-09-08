import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/water_website_db";

  console.log(`[MongoDB] Attempting connection to ${mongoUri}`);

  mongoose.connection.on("connected", () => {
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on("error", (err: any) => {
    console.error(`[MongoDB] Connection error:`, err?.message || err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn(`[MongoDB] Disconnected from database`);
  });

  try {
    // Set a 3-second server selection timeout so server isn't blocked endlessly when DB is down
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
  } catch (error: any) {
    console.error(`[MongoDB] Initial connection attempt failed: ${error?.message || error}`);
  }
};

export const getDbStatus = (): {
  state: string;
  isConnected: boolean;
  host?: string;
  name?: string;
} => {
  const readyStateMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const stateCode = mongoose.connection.readyState;
  const isConnected = stateCode === 1;

  return {
    state: readyStateMap[stateCode] || "unknown",
    isConnected,
    ...(isConnected && {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    }),
  };
};

export const closeDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("[MongoDB] Closed database connection");
  }
};
