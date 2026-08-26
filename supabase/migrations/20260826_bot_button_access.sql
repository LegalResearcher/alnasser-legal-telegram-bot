-- Registry for every user-facing navigation/content button managed by the bot.
-- This migration touches bot-owned tables only; source platform and Drive tables remain unchanged.

alter table public.bot_managed_menu_items drop constraint if exists bot_managed_menu_items_access_mode_check;
alter table public.bot_managed_menu_items add constraint bot_managed_menu_items_access_mode_check check (access_mode in ('free','premium','referral','hasad'));

alter table public.bot_managed_sections drop constraint if exists bot_managed_sections_access_mode_check;
alter table public.bot_managed_sections add constraint bot_managed_sections_access_mode_check check (access_mode in ('subscription','free','premium','referral','hasad'));

insert into public.bot_managed_sections (section_key, display_label, enabled, access_mode, sort_order)
values
  ('menu:search', '🔎 البحث القانوني', true, 'free', 10),
  ('menu:library', '📚 المكتبة القانونية', true, 'free', 20),
  ('menu:exams', '📝 بنك الأسئلة والاختبارات', true, 'free', 30),
  ('menu:documents', '📄 النماذج والصيغ القانونية', true, 'free', 40),
  ('menu:featured', '📌 المراجع المميزة', true, 'free', 50),
  ('menu:services', '🛠 الخدمات والأدوات', true, 'free', 60),
  ('menu:help', 'ℹ️ عن البوت والمساعدة', true, 'free', 80),
  ('search', '🔎 بحث موحّد في المكتبة', true, 'free', 110),
  ('browse', '📚 تصفح المكتبة', true, 'free', 120),
  ('judicial', '⚖️ القواعد والمبادئ القضائية', true, 'hasad', 210),
  ('legislation', '📜 التشريعات اليمنية', true, 'free', 220),
  ('important-laws', '🔐 أهم القوانين اليمنية التفاعلي', true, 'premium', 230),
  ('contract-templates', '📄 صيغ وعقود قانونية', true, 'hasad', 240),
  ('exams', '📝 بنك أسئلة كلية الشريعة والقانون', true, 'hasad', 310),
  ('secondary-exams', '🧮 بنك أسئلة اختبارات الثانوية العامة', true, 'hasad', 320),
  ('legal-forms', '📝 نماذج وصيغ قانونية', true, 'free', 410),
  ('illustrated-legal-forms', '🖼 نماذج مصورة وفق القوانين اليمنية', true, 'free', 420),
  ('featured', '📌 مراجع مميزة', true, 'free', 510),
  ('latest', '🆕 أحدث الإضافات', true, 'free', 520),
  ('popular', '⭐ الأكثر طلبًا', true, 'free', 530),
  ('favorites', '⭐ مفضلتي', true, 'free', 540),
  ('support', '💬 تواصل ودعم', true, 'free', 610),
  ('referral', '🎁 نظام الإحالة', true, 'free', 620)
on conflict (section_key) do nothing;
