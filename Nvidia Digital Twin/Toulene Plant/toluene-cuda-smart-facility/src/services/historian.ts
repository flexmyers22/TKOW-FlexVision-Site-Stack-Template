import type { SupabaseClient } from '@supabase/supabase-js';

export interface HistorySample {
  equipment_tag: string;
  sensor_tag: string;
  value: number;
  timestamp?: string;
}

export async function writeProcessHistory(
  supabase: SupabaseClient,
  samples: HistorySample[],
  timestamp?: string
): Promise<{ count: number; error?: string }> {
  if (samples.length === 0) return { count: 0 };

  const ts = timestamp ?? new Date().toISOString();
  const rows = samples.map((s) => ({
    equipment_tag: s.equipment_tag,
    sensor_tag: s.sensor_tag,
    value: s.value,
    timestamp: s.timestamp ?? ts,
  }));

  const { error } = await supabase.from('process_history').insert(rows);
  if (error) return { count: 0, error: error.message };
  return { count: rows.length };
}

export function samplesFromUnitOutputs(
  equipmentTag: string,
  outputs: Record<string, number | string>
): HistorySample[] {
  const samples: HistorySample[] = [];
  for (const [key, val] of Object.entries(outputs)) {
    if (typeof val === 'number') {
      samples.push({
        equipment_tag: equipmentTag,
        sensor_tag: `${equipmentTag}_${key}`,
        value: val,
      });
    }
  }
  return samples;
}
