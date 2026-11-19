-- 다시 오는 그 해(인생 걷기 마지막 장) — 되돌아가고 싶은 순간과 두 통의 편지. 추가분만: 기존 표·규칙은 건드리지 않는다.
-- 상태: 초안(2026-11-19). 서울 DB 롤백 시험 13/13 통과(2026-11-19, 남은 것 없음 확인). 실제 적용은 배포 승인 때.
-- 설명 문서: docs/content-dogam-letterbox-plan.md 4장
--
-- 원칙
--  · 본인만 읽고 쓴다(관리자도 못 읽음). 상담 때 자림에게 보이려면 본인이 따로 첨부해야 한다.
--  · 생년월일·사주는 넣지 않는다. 해(연도)·순간 종류·한 줄(60자)·편지 두 통(각 300자)만.
--  · 사람당 1행. '처음부터 다시'를 누르면 앱이 행을 지운다. 계정을 지우면 함께 지워진다.

create table public.walk_returns (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  moments    jsonb       not null default '[]'::jsonb,   -- [{ y, kind, memo }] 최대 3개
  letters    jsonb       not null default '{}'::jsonb,   -- { past, future, pastYear, futureYear, opened, none }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint walk_returns_moments_shape check (jsonb_typeof(moments) = 'array' and jsonb_array_length(moments) <= 3 and pg_column_size(moments) <= 2000),
  constraint walk_returns_letters_shape check (jsonb_typeof(letters) = 'object' and pg_column_size(letters) <= 4000)
);
create trigger trg_walk_returns_touch before update on public.walk_returns
  for each row execute function public.jalim_touch_updated_at();

alter table public.walk_returns enable row level security;
revoke all on public.walk_returns from anon, authenticated;
grant select, insert, update, delete on public.walk_returns to authenticated;
revoke truncate, references, trigger on public.walk_returns from authenticated;
create policy "walk_returns own" on public.walk_returns
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
