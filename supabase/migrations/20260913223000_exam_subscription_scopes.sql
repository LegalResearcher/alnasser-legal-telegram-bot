-- Exam subscription scopes and per-scope access mode.
-- This migration is intentionally additive and is not applied automatically.

create table if not exists public.bot_exam_subscription_scopes (
  access_scope text primary key,
  display_label text not null,
  access_mode text not null default 'premium' check (access_mode in ('free', 'premium', 'disabled')),
  disabled_message text,
  updated_at timestamptz not null default now()
);

insert into public.bot_exam_subscription_scopes (access_scope, display_label, access_mode)
values
  ('level_1', 'المستوى الأول', 'premium'),
  ('level_2', 'المستوى الثاني', 'premium'),
  ('level_3', 'المستوى الثالث', 'premium'),
  ('level_4', 'المستوى الرابع', 'premium'),
  ('secondary_literary', 'ثالث ثانوي — القسم الأدبي', 'premium'),
  ('secondary_scientific', 'ثالث ثانوي — القسم العلمي', 'premium')
on conflict (access_scope) do nothing;

alter table public.bot_exam_subscription_scopes enable row level security;

create policy "service role manages exam subscription scopes"
on public.bot_exam_subscription_scopes
for all to service_role
using (true) with check (true);

create policy "admins manage exam subscription scopes"
on public.bot_exam_subscription_scopes
for all to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

create index if not exists bot_user_access_exam_scope_idx
  on public.bot_user_access (telegram_user_id, access_scope, expires_at);

comment on table public.bot_exam_subscription_scopes is
  'Per-package free/premium/disabled mode for Telegram exam access.';
