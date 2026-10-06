import type { User } from "@supabase/supabase-js";
import type { Customer, Profile } from "./index.js";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: User;
      profile?: Profile | null;
      customer?: Customer | null;
    }
  }
}

export {};
