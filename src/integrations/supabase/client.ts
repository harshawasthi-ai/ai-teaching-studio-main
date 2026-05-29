import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
