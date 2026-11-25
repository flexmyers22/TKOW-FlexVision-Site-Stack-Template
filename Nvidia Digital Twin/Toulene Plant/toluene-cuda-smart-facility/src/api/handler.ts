import './loadEnv.js';
import { withSupabase } from '@supabase/server';

/**
 * Example fetch handler for equipment API routes.
 * On Supabase Edge Functions, export this as default { fetch }.
 */
export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', project: 'toluene-cuda-smart-facility' });
    }

    if (url.pathname === '/equipment' && req.method === 'GET') {
      const { data, error } = await ctx.supabase
        .from('toluene_equipment')
        .select('equipment_tag, equipment_type, process_area, binary_status, cuda_tile_id, metadata')
        .order('equipment_tag');

      if (error) {
        return Response.json({ message: error.message }, { status: 500 });
      }

      return Response.json(data);
    }

    return Response.json({ message: 'Not found' }, { status: 404 });
  }),
};
