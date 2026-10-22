-- 기운 체크인 기록(daily_checkins) — 추가분만: 기존 표·규칙·함수는 건드리지 않는다. (공용 함수 jalim_touch_updated_at은 이미 있어 그대로 쓴다)
-- 상태: ✅ 2026-10-23 도쿄 DB(vdnbnuxhjhckzrryvezl)에 적용함(마이그레이션 daily_checkins). 적용 전 롤백 시험 25/25 통과, 적용 후 권한·advisor 재점검 이상 없음(새 경고 0).
-- 설명 문서: docs/checkin-plan.md

-- 1) 날짜 검사: 먼 미래 날짜는 거부한다(한국 날짜가 UTC보다 앞서므로 하루까지는 허용).
--    'check' 제약에 now()류를 쓰면 복원 때 문제가 되어 트리거로 둔다. 과거 소급 한도(7일)는 앱 규칙이라 DB는 막지 않는다.
create or replace function public.jalim_checkin_day_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.day > (current_date + 1) then
    raise exception 'checkin day is in the future' using errcode = '23514';   -- check_violation
  end if;
  return new;
end $$;
revoke all on function public.jalim_checkin_day_guard() from public, anon, authenticated;

-- 2) 기운 체크인 — 로그인한 사람이 하루에 한 번 남기는 기분(-2~+2)과 한 줄 메모. 본인 전용.
--    일진·오행은 저장하지 않는다(날짜로 앱이 다시 계산). 출생정보도 이 표에 두지 않는다(공용 프로필 core_profiles를 따로 읽는다).
--    공용 정보 동의를 거둬도 기록은 남는다. 계정 탈퇴하면 함께 지워진다. 관리자도 읽지 못한다.
create table public.daily_checkins (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null check (day >= date '2020-01-01'),
  mood       smallint    not null check (mood between -2 and 2),       -- 😣 -2 · 😕 -1 · 😐 0 · 🙂 +1 · 😄 +2
  memo       text        check (memo is null or char_length(memo) <= 40),
  tag        text        check (tag is null or char_length(tag) <= 20),   -- 일·사람·돈·몸·마음·쉼 중 고른 칩
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_one_per_day unique (user_id, day)
);
create trigger trg_daily_checkins_guard before insert or update of day on public.daily_checkins
  for each row execute function public.jalim_checkin_day_guard();
create trigger trg_daily_checkins_touch before update on public.daily_checkins
  for each row execute function public.jalim_touch_updated_at();

alter table public.daily_checkins enable row level security;
revoke all on public.daily_checkins from anon, authenticated;
grant select, insert, update, delete on public.daily_checkins to authenticated;
revoke truncate, references, trigger on public.daily_checkins from authenticated;
create policy "daily_checkins own" on public.daily_checkins
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
