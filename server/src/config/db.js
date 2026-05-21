import mongoose from "mongoose";

const connectWithUri = async (mongoUri) =>
  mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  const mongoDirectUri = process.env.MONGO_DIRECT_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Add it to server/.env.");
  }

  try {
    const connection = await connectWithUri(mongoUri);
    console.log(`MongoDB connected: ${connection.connection.host}`);
    return;
  } catch (error) {
    const shouldTryDirectUri = mongoDirectUri && mongoDirectUri !== mongoUri;

    if (!shouldTryDirectUri) {
      throw error;
    }

    console.warn(`Primary MongoDB URI failed, retrying with direct Atlas URI: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    const fallbackConnection = await connectWithUri(mongoDirectUri);
    console.log(`MongoDB connected through direct Atlas URI: ${fallbackConnection.connection.host}`);
  }
};
