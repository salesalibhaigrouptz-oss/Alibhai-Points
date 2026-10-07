import { supabase } from "../src/config/supabase.js";

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
 * This script is intended to be run daily via:
 * 1. Cron job (Linux/Mac): 0 5 * * * cd /path/to/api && npm run expiry
 * 2. pg_cron (Supabase): See documentation in supabase/schema.sql
 * 3. Scheduled task (Windows): Task Scheduler
 *
 * East Africa Time (EAT) is UTC+3, so 00:05 EAT = 21:05 UTC
 */

async function runExpiryJob() {
  console.log("🔄 Starting expiry job...");
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  try {
    const { data, error } = await supabase.rpc("expire_overdue_customers");

    if (error) {
      console.error("❌ Error running expiry job:", error);
      process.exit(1);
    }

    const expiredCount = data || 0;

    console.log(`✅ Expiry job completed successfully`);
    console.log(`📊 Customers expired: ${expiredCount}`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);

    if (expiredCount > 0) {
      console.log(`⚠️  ${expiredCount} customer(s) became inactive and points were expired`);
    } else {
      console.log(`✨ No customers expired - all are within the activity deadline`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

// Run the job
runExpiryJob();
