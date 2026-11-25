import '../loadEnv.js';
import { createAdminClient } from '@supabase/server/core';

/** Service-role client — bypasses RLS. Use in scripts and trusted server code only. */
export function getAdminClient() {
  return createAdminClient();
}
