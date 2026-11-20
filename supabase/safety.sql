-- ============================================================
-- 行李規劃 app：雲端資料的安全設定（整段複製，貼到 Supabase 的 SQL Editor 按 Run 執行一次）
-- 重複執行也沒關係，不會刪掉任何已存的資料。
--
-- 做了三件事（都是資料庫自己做的，就算 app 有錯、或某台裝置還在用舊版 app，也一樣有效）：
--   1. 之前的版本：每次更新 app_state 之前，把「上一版」複製到 app_state_history，每個帳號保留最近 50 版。
--      app 的帳號選單 →「還原到之前的版本」可以選時間還原。
--   2. 擋下異常的更新：物品或旅程一次少了一半以上，資料庫直接拒絕（除非使用者在 app 裡確認過）。
--   3. 擋下範例資料：範例資料永遠不能存進雲端。
--   每個人只能看到、還原自己的版本（Row Level Security）。
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

-- 每個人只能看到自己的歷史紀錄；寫入只能由下面的 trigger 負責（app 不能直接新增、修改、刪除）
alter table public.app_state_history enable row level security;
revoke all on public.app_state_history from anon, authenticated;
grant select on public.app_state_history to authenticated;
drop policy if exists "own history select" on public.app_state_history;
create policy "own history select" on public.app_state_history
  for select to authenticated using ((select auth.uid()) = user_id);

-- 數一下資料裡有幾樣物品、幾趟旅程
create or replace function public.cmo_count(d jsonb, k text)
returns integer
language sql
immutable
as $$
  select case when jsonb_typeof(d -> k) = 'array' then jsonb_array_length(d -> k) else 0 end;
$$;

-- 2. 更新前先檢查：範例資料、或物品／旅程一次少一半以上 → 拒絕
--    （app 裡使用者按了「確定」或「還原到之前的版本」時，會在資料裡帶 shrinkOk = 這次的版本號，才放行）
create or replace function public.app_state_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  om integer; nm integer; ot integer; nt integer;
begin
  if new.data ? 'sampleBuilt' then
    raise exception 'CMO_SAMPLE_BLOCKED: sample data is never saved to the cloud' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    om := public.cmo_count(old.data, 'memory'); nm := public.cmo_count(new.data, 'memory');
    ot := public.cmo_count(old.data, 'trips');  nt := public.cmo_count(new.data, 'trips');
    if ((om >= 3 and nm * 2 < om) or (ot >= 2 and nt * 2 < ot))
       and coalesce(new.data ->> 'shrinkOk', '') <> new.version::text then
      raise exception 'CMO_SHRINK_BLOCKED: items % -> %, trips % -> %', om, nm, ot, nt using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists app_state_a_guard on public.app_state;
create trigger app_state_a_guard
  before insert or update on public.app_state
  for each row execute function public.app_state_guard();

-- 3. 更新前：把上一版存進歷史紀錄，只留最近 50 版
--    （trigger 依名稱順序執行：a_guard 先檢查，被擋下的更新不會留紀錄）
create or replace function public.app_state_keep_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.data is distinct from new.data then
    insert into public.app_state_history (user_id, version, data, item_count, trip_count, saved_at)
    values (old.user_id, old.version, old.data,
      public.cmo_count(old.data, 'memory'), public.cmo_count(old.data, 'trips'), coalesce(old.updated_at, now()));
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
drop trigger if exists app_state_b_history on public.app_state;
create trigger app_state_b_history
  before update on public.app_state
  for each row execute function public.app_state_keep_history();

-- 4. 執行當下先把每個人目前的雲端資料存一份（重複執行時，同一版不會重複存）
insert into public.app_state_history (user_id, version, data, item_count, trip_count, saved_at)
select s.user_id, s.version, s.data, public.cmo_count(s.data, 'memory'), public.cmo_count(s.data, 'trips'), s.updated_at
from public.app_state s
where not exists (
  select 1 from public.app_state_history h where h.user_id = s.user_id and h.version = s.version
);
