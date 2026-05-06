import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase } from "./db.js";

async function connectWithRetry() {
  while (true) {
    try {
      await connectDatabase();
      return;
    } catch (error) {
      console.error(`MongoDB connection failed: ${error.message}`);
      console.error("Retrying MongoDB connection in 10 seconds");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

async function main() {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API listening on ${config.port}`);
  });
  connectWithRetry();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
