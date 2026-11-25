-- cuda_tile_seed.sql
-- GPU tile assignments per equipment (insert cuda_tiles before toluene_equipment)

insert into cuda_tiles (
  tile_id, equipment_tag, kernel_name, memory_block,
  input_buffer, output_buffer, update_rate_ms, binary_word, status
) values
(
  'CUDA_TILE_R101', 'R101', 'thermal_state_kernel.cu', 'R101_BLOCK',
  'd_R101_in', 'd_R101_out', 100, '00001000', 'active'
),
(
  'CUDA_TILE_P101', 'P101', 'flow_balance_kernel.cu', 'P101_BLOCK',
  'd_P101_in', 'd_P101_out', 50, '00000100', 'active'
),
(
  'CUDA_TILE_H101', 'H101', 'thermal_state_kernel.cu', 'H101_BLOCK',
  'd_H101_in', 'd_H101_out', 100, '00001100', 'active'
),
(
  'CUDA_TILE_C101', 'C101', 'flow_balance_kernel.cu', 'C101_BLOCK',
  'd_C101_in', 'd_C101_out', 100, '00000110', 'active'
),
(
  'CUDA_TILE_T101', 'T101', 'binary_state_kernel.cu', 'T101_BLOCK',
  'd_T101_in', 'd_T101_out', 200, '00000001', 'active'
)
on conflict (tile_id) do nothing;
