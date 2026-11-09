-- 심화상담 신청에 연락처(전화번호·통화 편한 시간) 추가 — 상담은 대부분 유선통화라서.
-- 기존 request_app_access(2인자)는 그대로 둔다(예전 화면이 계속 동작). 새 화면은 request_counsel 을 쓴다.
-- 번호는 신청자 본인과 관리자만 볼 수 있고(app_access 읽기 규칙 그대로), 상담이 끝나면 clear_counsel_phone 으로 지운다.

alter table public.app_access
  add column if not exists phone          text,
  add column if not exists call_time      text,
  add column if not exists phone_consent_at timestamptz;

-- 신청 + 연락처 — 번호는 숫자만 9~11자리로 정리해 저장(010-1234-5678 → 01012345678)
create or replace function public.request_counsel(p_consent_version text, p_phone text, p_call_time text default null)
returns public.app_access language plpgsql security definer set search_path = public as $$
declare r public.app_access; d text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '28000'; end if;
  if coalesce(p_consent_version,'') = '' then raise exception 'consent required' using errcode = '22023'; end if;
  if length(d) < 9 or length(d) > 11 then raise exception 'bad phone' using errcode = '22023'; end if;
  insert into public.app_access(user_id, app, status, consent_at, consent_version, phone, call_time, phone_consent_at)
  values (auth.uid(), 'counsel', 'pending', now(), p_consent_version, d, left(nullif(trim(coalesce(p_call_time,'')),''),60), now())
  on conflict (user_id, app) do update
    set status = case when public.app_access.status = 'approved' then 'approved' else 'pending' end,
        consent_at = case when public.app_access.status = 'approved' then public.app_access.consent_at else now() end,
        consent_version = case when public.app_access.status = 'approved' then public.app_access.consent_version else excluded.consent_version end,
        requested_at = case when public.app_access.status = 'approved' then public.app_access.requested_at else now() end,
        decided_by = case when public.app_access.status = 'approved' then public.app_access.decided_by else null end,
        decided_at = case when public.app_access.status = 'approved' then public.app_access.decided_at else null end,
        phone = excluded.phone, call_time = excluded.call_time, phone_consent_at = now()
  returning * into r;
  return r;
end $$;

-- 상담이 끝나면 번호 삭제 — 관리자만
create or replace function public.clear_counsel_phone(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_jalim_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.app_access set phone = null, call_time = null where user_id = p_user and app = 'counsel';
end $$;

-- 신청 목록에 연락처 추가 (열이 늘어 반환 형식이 바뀌므로 지웠다 다시 만든다)
drop function if exists public.list_app_access(text);
create function public.list_app_access(p_app text)
returns table(user_id uuid, nickname text, email text, status text, requested_at timestamptz,
              consent_at timestamptz, decided_at timestamptz, note text, phone text, call_time text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_jalim_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.user_id, p.nickname, u.email::text, a.status, a.requested_at, a.consent_at, a.decided_at, a.note, a.phone, a.call_time
      from public.app_access a
      left join public.profiles p on p.id = a.user_id
      left join auth.users u on u.id = a.user_id
     where a.app = p_app
     order by (a.status = 'pending') desc, a.requested_at desc;
end $$;

revoke all on function public.request_counsel(text, text, text) from public;
revoke all on function public.clear_counsel_phone(uuid)         from public;
revoke all on function public.list_app_access(text)             from public;
revoke execute on function public.request_counsel(text, text, text) from anon;
revoke execute on function public.clear_counsel_phone(uuid)         from anon;
revoke execute on function public.list_app_access(text)             from anon;
grant execute on function public.request_counsel(text, text, text) to authenticated;
grant execute on function public.clear_counsel_phone(uuid)         to authenticated;
grant execute on function public.list_app_access(text)             to authenticated;
