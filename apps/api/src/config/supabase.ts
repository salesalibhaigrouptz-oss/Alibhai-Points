import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Service-role Supabase client (Server-side ONLY).
 * This client bypasses Row Level Security (RLS) to manage data and invoke RPCs.
 * NEVER send this client or its key to any client response or log.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
