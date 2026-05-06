import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase } from "./db.js";

async function main() {
  await connectDatabase();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API listening on ${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
