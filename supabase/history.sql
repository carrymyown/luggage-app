-- ============================================================
-- 行李規劃 app：雲端資料的「之前的版本」（整段複製，貼到 Supabase 的 SQL Editor 按 Run 執行一次）
-- 重複執行也沒關係，不會刪掉任何已存的資料。
--
-- 做了什麼：
--   每次 app 要更新雲端的 app_state 之前，資料庫會自動把「上一版」複製一份到 app_state_history，
--   每個帳號保留最近 50 版。app 的帳號選單 →「還原到之前的版本」可以選時間還原。
--   這是資料庫自己做的（trigger），就算 app 有錯也一定會留下上一版。
-- ============================================================

-- 1. 歷史紀錄表
create table if not exists public.app_state_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  version bigint,
  data jsonb not null,
  item_count integer,
  trip_count integer,
  saved_at timestamptz not null default now()
);
create index if not exists app_state_history_user_time on public.app_state_history (user_id, saved_at desc);

-- 每個人只能看到自己的歷史紀錄（寫入由下面的 trigger 負責，app 不能直接改）
alter table public.app_state_history enable row level security;
grant select on public.app_state_history to authenticated;
drop policy if exists "own history select" on public.app_state_history;
create policy "own history select" on public.app_state_history
  for select to authenticated using ((select auth.uid()) = user_id);

-- 2. 更新 app_state 之前：把上一版存進歷史紀錄，只留最近 50 版
create or replace function public.app_state_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.data is distinct from new.data then
    insert into public.app_state_history (user_id, version, data, item_count, trip_count, saved_at)
    values (
      old.user_id, old.version, old.data,
      case when jsonb_typeof(old.data -> 'memory') = 'array' then jsonb_array_length(old.data -> 'memory') else 0 end,
      case when jsonb_typeof(old.data -> 'trips') = 'array' then jsonb_array_length(old.data -> 'trips') else 0 end,
      coalesce(old.updated_at, now())
    );
    delete from public.app_state_history
    where user_id = old.user_id
      and id not in (
        select id from public.app_state_history
        where user_id = old.user_id
        order by saved_at desc, id desc
        limit 50
      );
  end if;
  return new;
end;
$$;

drop trigger if exists app_state_keep_history on public.app_state;
create trigger app_state_keep_history
  before update on public.app_state
  for each row execute function public.app_state_keep_history();

-- 3. 執行當下先把「目前的雲端資料」也存一份（之後不管怎麼同步，至少有這一版可以回來）
insert into public.app_state_history (user_id, version, data, item_count, trip_count, saved_at)
select user_id, version, data,
  case when jsonb_typeof(data -> 'memory') = 'array' then jsonb_array_length(data -> 'memory') else 0 end,
  case when jsonb_typeof(data -> 'trips') = 'array' then jsonb_array_length(data -> 'trips') else 0 end,
  updated_at
from public.app_state;
