export const modes = [
  'grid_following',
  'islanded',
  'black_start',
  'bess_peak_shave',
  'ai_buffer',
] as const;

export type ControlMode = (typeof modes)[number];
