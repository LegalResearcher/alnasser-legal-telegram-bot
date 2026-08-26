-- Bot-owned metadata overlays. These tables never modify source Drive/platform tables and never store file bytes.
create table if not exists public.bot_source_overrides (
  source_id bigint primary key,
  title text,
  description text,
  sort_order integer,
  is_featured boolean,
  enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists public.bot_folder_overrides (
  folder_id bigint primary key,
  name text,
  sort_order integer,
  enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.bot_source_overrides enable row level security;
alter table public.bot_folder_overrides enable row level security;
