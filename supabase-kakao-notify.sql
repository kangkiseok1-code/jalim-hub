-- 관리자 카카오톡 알림(나에게 보내기) — 토큰 보관·발송 기록·월말 정리 숫자.
-- 토큰 표는 서버 함수(서비스 키)만 읽고 쓴다: RLS를 켜고 anon·authenticated 권한을 모두 거둔다.
create table if not exists public.kakao_notify (
  id                 int primary key default 1 check (id = 1),   -- 한 줄만(관리자 한 명)
  access_token       text,
  access_expires_at  timestamptz,
  refresh_token      text,
  refresh_expires_at timestamptz,
  last_ok_at         timestamptz,
  last_kind          text,
  last_error         text,
  last_monthly_at    timestamptz,
  updated_at         timestamptz not null default now()
);
alter table public.kakao_notify enable row level security;
revoke all on public.kakao_notify from anon, authenticated;

-- 신청 알림 중복 방지(같은 사람이 짧은 시간에 여러 번 눌러도 한 번만)
alter table public.app_access add column if not exists notified_at timestamptz;

-- 월말 정리 숫자 — 이름·연락처 없이 건수만. 서버 함수(service_role)만 호출한다.
create or replace function public.notify_monthly_stats()
returns json language plpgsql security definer set search_path = public as $$
declare ms timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  return json_build_object(
    'signups',   (select count(*) from auth.users where created_at >= ms),
    'requests',  (select count(*) from public.app_access where app = 'counsel' and requested_at >= ms),
    'pending',   (select count(*) from public.app_access where app = 'counsel' and status = 'pending'),
    'oldest_pending', (select to_char(min(requested_at) at time zone 'Asia/Seoul', 'MM/DD') from public.app_access where app = 'counsel' and status = 'pending'),
    'phones_kept', (select count(*) from public.app_access where app = 'counsel' and phone is not null and status = 'approved')
  );
end $$;
revoke all on function public.notify_monthly_stats() from public, anon, authenticated;
grant execute on function public.notify_monthly_stats() to service_role;
