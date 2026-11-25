-- 009_ai_predictions.sql
-- AI inference layer (Blackwell GPU predictions)

create table ai_predictions (
  id uuid primary key default uuid_generate_v4(),
  equipment_tag text not null,
  prediction_type text not null,
  predicted_value numeric,
  confidence numeric,
  generated_at timestamptz default now(),
  metadata jsonb default '{}'
);

create index idx_ai_predictions_equipment on ai_predictions(equipment_tag);
create index idx_ai_predictions_type on ai_predictions(prediction_type);
create index idx_ai_predictions_generated on ai_predictions(generated_at desc);
