# Historian — time-series `process_history`

Plant runs and sensor simulators write to `process_history` at 1 Hz (configurable).

## Columns logged

- Temperature, pressure, flow, level, valve position, motor current

## Query example

```sql
select timestamp, equipment_tag, sensor_tag, value
from process_history
where equipment_tag = 'R101'
order by timestamp desc
limit 100;
```
