import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { supabase } from "./config/supabase.js";

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Alibhai Points API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  logger.info(`${signal} received: closing HTTP server gracefully...`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error(`Error closing server: ${err.message}`);
      process.exit(1);
    }
    logger.info("HTTP server closed successfully.");
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception - shutting down");
  shutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection - shutting down");
  shutdown("UNHANDLED_REJECTION");
});
