-- 자림 앱 입장 승인제 — 4-1 (추가분만: 기존 표·규칙은 건드리지 않는다)
-- 가입 + 정보공유 동의 → 관리자 승인 → 입장. 먼저 심화상담(counsel)에만 쓴다.
-- 적용 전 검증: 트랜잭션 안에서 돌린 뒤 롤백해 역할별 접근을 시험했고, 2026-10-22 실제 DB에 적용했다(app_access_counsel_approval + app_access_revoke_anon_exec).

-- 1) 관리자 판정 통일 — 심화상담은 JWT app_metadata.role, 만남은 profiles.is_admin을 써 왔다. 둘 중 하나면 관리자.
create or replace function public.is_jalim_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      or public.is_admin()
$$;

-- 2) 앱 입장 상태 표 — 읽기만 열고, 쓰기는 아래 함수로만(본인이 상태를 바꿀 수 없다)
create table public.app_access (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  app             text        not null check (app in ('counsel')),
  status          text        not null default 'pending' check (status in ('pending','approved','rejected')),
  consent_at      timestamptz,            -- 정보공유 동의 시각 (기존 사용자 자동 승인은 비어 있음)
  consent_version text,
  requested_at    timestamptz not null default now(),
  decided_by      uuid        references auth.users(id) on delete set null,
  decided_at      timestamptz,
  note            text,
  primary key (user_id, app)
);
alter table public.app_access enable row level security;
revoke all on public.app_access from anon, authenticated;
grant select on public.app_access to authenticated;
create policy "app_access read own or admin" on public.app_access
  for select to authenticated using (user_id = (select auth.uid()) or public.is_jalim_admin());

-- 3) 입장 가능 여부 — 관리자는 항상, 일반회원은 승인된 때만
create or replace function public.has_app_access(p_app text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_jalim_admin()
      or exists (select 1 from public.app_access a
                 where a.user_id = auth.uid() and a.app = p_app and a.status = 'approved')
$$;

-- 4) 신청 — 정보공유 동의와 함께. 승인된 사람은 그대로 두고, 거절·대기는 다시 대기로.
create or replace function public.request_app_access(p_app text, p_consent_version text)
returns public.app_access language plpgsql security definer set search_path = public as $$
declare r public.app_access;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '28000'; end if;
  if coalesce(p_consent_version,'') = '' then raise exception 'consent required' using errcode = '22023'; end if;
  insert into public.app_access(user_id, app, status, consent_at, consent_version)
  values (auth.uid(), p_app, 'pending', now(), p_consent_version)
  on conflict (user_id, app) do update
    set status = case when public.app_access.status = 'approved' then 'approved' else 'pending' end,
        consent_at = case when public.app_access.status = 'approved' then public.app_access.consent_at else now() end,
        consent_version = case when public.app_access.status = 'approved' then public.app_access.consent_version else excluded.consent_version end,
        requested_at = case when public.app_access.status = 'approved' then public.app_access.requested_at else now() end,
        decided_by = case when public.app_access.status = 'approved' then public.app_access.decided_by else null end,
        decided_at = case when public.app_access.status = 'approved' then public.app_access.decided_at else null end
  returning * into r;
  return r;
end $$;

-- 5) 승인·거절 — 관리자만
create or replace function public.decide_app_access(p_user uuid, p_app text, p_status text, p_note text default null)
returns public.app_access language plpgsql security definer set search_path = public as $$
declare r public.app_access;
begin
  if not public.is_jalim_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.app_access
     set status = p_status, decided_by = auth.uid(), decided_at = now(), note = p_note
   where user_id = p_user and app = p_app
   returning * into r;
  if not found then raise exception 'no such request' using errcode = 'P0002'; end if;
  return r;
end $$;

-- 6) 신청 목록 — 관리자만 (식별용 닉네임·이메일 포함)
create or replace function public.list_app_access(p_app text)
returns table(user_id uuid, nickname text, email text, status text, requested_at timestamptz,
              consent_at timestamptz, decided_at timestamptz, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_jalim_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.user_id, p.nickname, u.email::text, a.status, a.requested_at, a.consent_at, a.decided_at, a.note
      from public.app_access a
      left join public.profiles p on p.id = a.user_id
      left join auth.users u on u.id = a.user_id
     where a.app = p_app
     order by (a.status = 'pending') desc, a.requested_at desc;
end $$;

-- 7) 함수 실행 권한 — 기본으로 열려 있는 PUBLIC 권한을 거두고 필요한 역할에만
revoke all on function public.is_jalim_admin()                         from public;
revoke all on function public.has_app_access(text)                     from public;
revoke all on function public.request_app_access(text, text)           from public;
revoke all on function public.decide_app_access(uuid, text, text, text) from public;
revoke all on function public.list_app_access(text)                    from public;
grant execute on function public.is_jalim_admin()                      to anon, authenticated;   -- 정책식에서 쓰이므로 anon도 호출 가능(결과는 false)
grant execute on function public.has_app_access(text)                  to anon, authenticated;
grant execute on function public.request_app_access(text, text)        to authenticated;
grant execute on function public.decide_app_access(uuid, text, text, text) to authenticated;
grant execute on function public.list_app_access(text)                 to authenticated;

-- 7-1) Supabase는 새 함수에 anon·authenticated 권한을 따로 붙인다(위 revoke from public으로는 안 지워짐) → 로그인 필요한 함수는 anon을 명시적으로 거둔다 (2026-10-22 적용 후 확인에서 발견)
revoke execute on function public.request_app_access(text, text)        from anon;
revoke execute on function public.decide_app_access(uuid, text, text, text) from anon;
revoke execute on function public.list_app_access(text)                 from anon;

-- 8) 기존 사용자 — 상담 기록(상담사로 만든 기록 또는 내담자로 보낸 정보)이 있는 사람만 자동 승인
insert into public.app_access(user_id, app, status, decided_at, note)
select u.id, 'counsel', 'approved', now(), '기존 상담 기록 자동 승인 (2026-10-22)'
  from auth.users u
 where u.id in (select counselor_id from public.consultations
                union
                select client_id from public.submissions where client_id is not null)
on conflict (user_id, app) do nothing;
