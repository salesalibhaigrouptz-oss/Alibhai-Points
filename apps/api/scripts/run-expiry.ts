import { supabase } from "../src/config/supabase.js";
import { logger } from "../src/utils/logger.js";

/**
 * Expiry Job Script
 *
 * This script calls the expire_overdue_customers SQL function to:
 * - Check all active customers
 * - Expire points for customers who haven't made a purchase within the inactivity period
 * - Set customer status to inactive
 * - Cancel any pending redemption requests
 *
 * The inactivity period is defined in the active point_rules table (default: 25 days)
 *
 * This script is for an explicit one-time manual run only. The daily schedule
 * is owned by Supabase pg_cron, not by the API or its runtime.
 *
 * East Africa Time (EAT) is UTC+3, so 00:05 EAT = 21:05 UTC
 */

async function runExpiryJob() {
  logger.info("Starting one-time expiry run");

  try {
    const { data, error } = await supabase.rpc("expire_overdue_customers");

    if (error) {
      logger.error("Expiry run failed");
      process.exit(1);
    }

    const expiredCount = data || 0;

    logger.info({ expiredCount }, "Expiry run completed");

    process.exit(0);
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Expiry run failed");
    process.exit(1);
  }
}

// Run the job
runExpiryJob();
