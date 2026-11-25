-- cuda_tiles_extended_seed.sql
-- Additional tiles: D101, C102, C103, ELECTRICAL, ENERGY, SAFETY

insert into cuda_tiles (
  tile_id, equipment_tag, kernel_name, memory_block,
  input_buffer, output_buffer, update_rate_ms, binary_word, status
) values
  ('CUDA_TILE_D101', 'D101', 'flow_balance_kernel.cu', 'D101_BLOCK', 'd_D101_in', 'd_D101_out', 100, '00000100', 'active'),
  ('CUDA_TILE_C102', 'C102', 'flow_balance_kernel.cu', 'C102_BLOCK', 'd_C102_in', 'd_C102_out', 100, '00000110', 'active'),
  ('CUDA_TILE_C103', 'C103', 'flow_balance_kernel.cu', 'C103_BLOCK', 'd_C103_in', 'd_C103_out', 100, '00000110', 'active'),
  ('CUDA_TILE_ELECTRICAL', null, 'binary_state_kernel.cu', 'ELECTRICAL_BLOCK', 'd_ELEC_in', 'd_ELEC_out', 500, '00000001', 'active'),
  ('CUDA_TILE_ENERGY', null, 'energy_metrics_kernel.cu', 'ENERGY_BLOCK', 'd_ENERGY_in', 'd_ENERGY_out', 1000, '00000000', 'active'),
  ('CUDA_TILE_SAFETY', null, 'binary_state_kernel.cu', 'SAFETY_BLOCK', 'd_SAFETY_in', 'd_SAFETY_out', 50, '00000000', 'active')
on conflict (tile_id) do nothing;
