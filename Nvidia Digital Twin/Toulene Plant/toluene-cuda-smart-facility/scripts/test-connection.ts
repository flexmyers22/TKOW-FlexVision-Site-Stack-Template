import '../src/loadEnv.js';
import { createAdminClient } from '@supabase/server/core';

const sb = createAdminClient();
const { error } = await sb.from('toluene_equipment').select('equipment_tag').limit(1);

if (error) {
  console.log('Connected to Supabase, but:', error.message);
} else {
  console.log('Connected — toluene_equipment reachable');
}
