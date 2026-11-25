# Sensors — PLC I/O mapping

See `database/seeds/sensor_registry_seed.sql` and `sensor_registry` table.

Sensor tags follow pattern: `{Type}{Area}{Unit}` e.g. `TT103`, `FT101`, `LT101`.

Each sensor maps to a CUDA tile for GPU processing.
