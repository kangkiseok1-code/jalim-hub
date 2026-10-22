-- 자림 공용 프로필(core_profiles) + 인생 다시 걷기 답(journey_answers) — 추가분만: 기존 표·규칙·함수는 건드리지 않는다.
-- 상태: ✅ 2026-10-22 도쿄 DB(vdnbnuxhjhckzrryvezl)에 적용함(마이그레이션 core_profiles_journey_answers). 적용 전 롤백 시험 28/28 통과(supabase-core-profiles-test.sql), 적용 후 권한·advisor 재점검 이상 없음.
-- 설명 문서: docs/jalim-core-profiles-plan.md

-- 1) updated_at 자동 갱신 (두 표 공용)
create or replace function public.jalim_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = clock_timestamp();   -- now()는 한 트랜잭션 안에서 멈춰 있어, 시각이 실제로 흐르는 값을 쓴다
  return new;
end $$;
revoke all on function public.jalim_touch_updated_at() from public, anon, authenticated;

-- 2) 공용 프로필 — "다른 자림 앱에서도 내 출생정보를 쓴다"고 동의한 사람만 행이 생긴다.
--    저장 = 동의(동의 시각·문구 버전이 필수). 동의 철회 = 행 삭제. 관리자도 읽지 못한다(본인 전용).
create table public.core_profiles (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  nickname        text        check (nickname is null or char_length(nickname) between 1 and 20),
  gender          text        check (gender in ('male','female')),      -- 만남·심화상담과 같은 값(재물운의 M/F는 앱에서 바꿔 읽는다)
  calendar        text        not null default 'solar' check (calendar in ('solar','lunar')),
  leap            boolean     not null default false,
  birth_y         integer     not null check (birth_y  between 1900 and 2100),
  birth_mo        integer     not null check (birth_mo between 1 and 12),
  birth_d         integer     not null check (birth_d  between 1 and 31),
  birth_h         integer     check (birth_h   between 0 and 23),
  birth_min       integer     check (birth_min between 0 and 59),
  time_unknown    boolean     not null default false,
  birth_city      text        check (birth_city is null or char_length(birth_city) <= 40),
  consent_at      timestamptz not null default now(),
  consent_version text        not null check (char_length(consent_version) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint core_profiles_leap_lunar   check (not leap or calendar = 'lunar'),
  constraint core_profiles_time_unknown check (not (time_unknown and birth_h is not null))
);
create trigger trg_core_profiles_touch before update on public.core_profiles
  for each row execute function public.jalim_touch_updated_at();

alter table public.core_profiles enable row level security;
revoke all on public.core_profiles from anon, authenticated;
grant select, insert, update, delete on public.core_profiles to authenticated;
create policy "core_profiles own" on public.core_profiles
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) 인생 다시 걷기 답 — 로그인한 사람이 걸으며 남긴 점수(해마다 1개). 본인 전용.
--    공용 프로필과 따로 둔다: 출생정보 공유 동의를 거둬도 내 기록은 남는다. 계정 탈퇴(delete_me)하면 함께 지워진다.
create table public.journey_answers (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  year       integer     not null check (year between 1900 and 2100),
  score      smallint    not null check (score between -5 and 5),     -- 인생 사건 영향 점수와 같은 척도
  memo       text        check (memo is null or char_length(memo) <= 40),
  tag        text        check (tag is null or char_length(tag) <= 20),   -- 멈춘 이유(큰 흐름이 바뀐 해 등)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journey_answers_one_per_year unique (user_id, year)
);
create trigger trg_journey_answers_touch before update on public.journey_answers
  for each row execute function public.jalim_touch_updated_at();

alter table public.journey_answers enable row level security;
revoke all on public.journey_answers from anon, authenticated;
grant select, insert, update, delete on public.journey_answers to authenticated;
revoke truncate, references, trigger on public.core_profiles   from authenticated;
revoke truncate, references, trigger on public.journey_answers from authenticated;
create policy "journey_answers own" on public.journey_answers
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
