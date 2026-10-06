import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestId } from "./middleware/requestId.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/error.js";
import routes from "./routes.js";
import { AppError } from "./utils/errors.js";

export function createApp(): Express {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  const corsOrigins =
    env.CORS_ORIGINS === "*"
      ? "*"
      : env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    })
  );

  // Request ID generator
  app.use(requestId);

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP Request Logging with Pino (silenced during unit/integration tests)
  if (env.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id || "unknown",
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
      })
    );
  }

  // Rate Limiting
  app.use(apiLimiter);

  // Mount API Routes under /api
  app.use("/api", routes);

  // Catch-all 404 handler
  app.use((req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", `Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
