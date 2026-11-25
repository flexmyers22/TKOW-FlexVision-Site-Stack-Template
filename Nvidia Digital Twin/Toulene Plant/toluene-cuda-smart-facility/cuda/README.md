# CUDA Tile Engine

Blackwell GPU kernels mapped to `cuda_tiles` in Supabase.

## Tile registry

| Tile ID | Kernel |
|---------|--------|
| CUDA_TILE_T101 | `binary_state_kernel.cu` |
| CUDA_TILE_P101 | `pump_dynamics_kernel.cu` |
| CUDA_TILE_H101 | `reactor_heat_kernel.cu` |
| CUDA_TILE_R101 | `reactor_heat_kernel.cu` |
| CUDA_TILE_D101 | `flow_balance_kernel.cu` |
| CUDA_TILE_C101 | `distillation_kernel.cu` |
| CUDA_TILE_C102 | `flow_balance_kernel.cu` |
| CUDA_TILE_C103 | `flow_balance_kernel.cu` |
| CUDA_TILE_ELECTRICAL | `binary_state_kernel.cu` |
| CUDA_TILE_ENERGY | `energy_metrics_kernel.cu` |
| CUDA_TILE_SAFETY | `binary_state_kernel.cu` |

## Pipeline

```
PLC / Supabase → Binary Compiler → CUDA Tile Engine → USD Scene Graph → Omniverse
```

Kernels live alongside this folder as `.cu` files when compiled for deployment.
