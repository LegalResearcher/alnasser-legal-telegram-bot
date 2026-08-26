-- Atomic admin decision for bot-owned subscription requests.
-- Source platform tables are not touched.
create or replace function public.bot_admin_decide_subscription_request(
  p_request_id bigint,
  p_decision text,
  p_admin_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.bot_subscription_requests%rowtype;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid_subscription_decision';
  end if;
  if p_admin_user_id is null or length(trim(p_admin_user_id)) = 0 then
    raise exception 'admin_identity_required';
  end if;

  select * into request_row
  from public.bot_subscription_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    return null;
  end if;

  update public.bot_subscription_requests
  set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewed_by = p_admin_user_id,
      reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'approve' then
    if request_row.access_scope = 'important_laws' and request_row.managed_menu_item_id is not null then
      insert into public.bot_user_access (telegram_user_id, access_scope, managed_menu_item_id, approved_by, expires_at, updated_at)
      values (request_row.telegram_user_id, 'managed_menu', request_row.managed_menu_item_id, p_admin_user_id, null, now())
      on conflict (telegram_user_id, access_scope, managed_menu_item_id)
      do update set approved_by = excluded.approved_by, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
    else
      if exists (
        select 1 from public.bot_user_access
        where telegram_user_id = request_row.telegram_user_id
          and access_scope = request_row.access_scope
          and managed_menu_item_id is null
      ) then
        update public.bot_user_access
        set approved_by = p_admin_user_id, expires_at = null, updated_at = now()
        where telegram_user_id = request_row.telegram_user_id
          and access_scope = request_row.access_scope
          and managed_menu_item_id is null;
      else
        insert into public.bot_user_access (telegram_user_id, access_scope, managed_menu_item_id, approved_by, expires_at, updated_at)
        values (request_row.telegram_user_id, request_row.access_scope, null, p_admin_user_id, null, now());
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'telegramUserId', request_row.telegram_user_id,
    'chatId', request_row.chat_id,
    'accessScope', request_row.access_scope,
    'managedMenuItemId', request_row.managed_menu_item_id
  );
end;
$$;

grant execute on function public.bot_admin_decide_subscription_request(bigint, text, text) to service_role;
