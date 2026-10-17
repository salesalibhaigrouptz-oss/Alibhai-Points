import { type Server } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const server: Server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "Alibhai Points API listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Closing local API server");
  server.close((error) => {
    if (error) {
      logger.error({ errorType: error.name }, "Failed to close local API server");
      process.exitCode = 1;
      return;
    }
    logger.info("Local API server closed");
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("uncaughtException", (error) => {
  logger.fatal({ errorType: error.name }, "Uncaught exception");
  process.exit(1);
});
process.once("unhandledRejection", (reason: unknown) => {
  logger.fatal(
    { errorType: reason instanceof Error ? reason.name : typeof reason },
    "Unhandled promise rejection"
  );
  process.exit(1);
});
