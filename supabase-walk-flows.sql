-- 함께 걷는 궁합 — 초대 링크로 짝을 맺고, 허용한 사람의 '해마다 흐름 배열'만 서로 읽는다. 추가분만: 기존 표·규칙·함수는 건드리지 않는다.
-- 상태: ✅ 2026-10-25 도쿄 DB(vdnbnuxhjhckzrryvezl)에 적용함(마이그레이션 walk_flows_pairs). 적용 전 롤백 시험 72/72 통과, 적용 후 권한·advisor 재점검 이상 없음(새 경고는 의도한 함수 6개뿐).
--       적용 전 롤백 시험(supabase-walk-flows-test.sql)을 먼저 통과시킬 것.
-- 설명 문서: docs/pair-walk-plan.md
--
-- 원칙
--  · 이 표들에는 생년월일·시각·출생지·사주를 넣지 않는다. 해마다 흐름의 '거친 값'(엔진 net 값을 0.5 눈금 정수로 줄임)과 해마다 톤(g/m/b)만 둔다.
--  · walk_flows 행이 있다 = "같이 걷기에 내 흐름을 써도 된다"(core_profiles와 같은 방식, 저장 = 동의). 끄면 행을 삭제한다. 본인만 읽고 쓴다(관리자도 못 읽음).
--  · 짝은 초대 링크로 맺는다: 초대하는 사람이 링크(토큰)를 만들고, 받은 사람이 로그인해 수락해야 짝이 된다(둘 다 동의). 어느 쪽이든 끝낼 수 있다.
--  · 다른 사람 행은 직접 읽지 못한다. 수락된 짝이고 둘 다 허용을 켠 경우에만 walk_pair 함수가 두 사람의 배열과 별칭만 돌려준다.
--  · 별칭은 초대할 때·수락할 때 각자 정한다(만남 프로필에 의존하지 않는다). 나중에 만남 연결 방식을 열 때는 source='match'로 같은 표를 쓴다.

-- 1) 흐름 배열 입력 검사 트리거 (CHECK 제약은 배열 원소별 검사를 못 해 트리거로 둔다)
create or replace function public.walk_flows_guard()
returns trigger language plpgsql set search_path = public as $$
declare n integer; bad boolean;
begin
  n := coalesce(array_length(new.net2, 1), 0);
  if n < 1 or n > 61 then raise exception 'walk_flows: length out of range' using errcode = '23514'; end if;
  if char_length(new.tones) <> n or new.tones !~ '^[gmb]+$' then raise exception 'walk_flows: bad tones' using errcode = '23514'; end if;
  select bool_or(v is null or v < -8 or v > 4) into bad from unnest(new.net2) as v;
  if bad then raise exception 'walk_flows: value out of range' using errcode = '23514'; end if;
  if new.from_year + n - 1 > 2100 then raise exception 'walk_flows: year out of range' using errcode = '23514'; end if;
  return new;
end $$;
revoke all on function public.walk_flows_guard() from public, anon, authenticated;

-- 2) 허용한 사람의 해마다 흐름 — 사람당 1행
create table public.walk_flows (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  from_year       smallint    not null check (from_year between 1900 and 2100),
  net2            smallint[]  not null,                         -- 해마다 흐름 × 2 (0.5 눈금 정수, -8..4), 첫 원소가 from_year
  tones           text        not null,                         -- 해마다 톤 한 글자: g 좋음 · m 혼재 · b 힘듦 (길이 = net2 길이)
  calc_version    text        not null check (char_length(calc_version) between 1 and 20),   -- 계산 규칙 버전(규칙이 바뀌면 앱이 다시 올린다)
  consent_at      timestamptz not null default now(),
  consent_version text        not null check (char_length(consent_version) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_walk_flows_guard before insert or update on public.walk_flows
  for each row execute function public.walk_flows_guard();
create trigger trg_walk_flows_touch before update on public.walk_flows
  for each row execute function public.jalim_touch_updated_at();

alter table public.walk_flows enable row level security;
revoke all on public.walk_flows from anon, authenticated;
grant select, insert, update, delete on public.walk_flows to authenticated;
revoke truncate, references, trigger on public.walk_flows from authenticated;
create policy "walk_flows own" on public.walk_flows
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) 짝 — 초대 링크(토큰)로 맺는다. 열린 초대는 7일 뒤 만료, 사람당 열린 초대 10개까지, 전체 50개까지.
create table public.walk_pairs (
  id            uuid        primary key default gen_random_uuid(),
  inviter       uuid        not null references auth.users(id) on delete cascade,
  invitee       uuid        references auth.users(id) on delete cascade,
  token         text        not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),   -- 64자 무작위(앱이 정하지 못한다)
  source        text        not null default 'link' check (source in ('link', 'match')),     -- 'match' = 나중에 열 만남 연결 방식용
  status        text        not null default 'open' check (status in ('open', 'accepted', 'revoked')),
  inviter_alias text        not null check (char_length(inviter_alias) between 1 and 20),
  invitee_alias text        check (invitee_alias is null or char_length(invitee_alias) between 1 and 20),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  constraint walk_pairs_not_self    check (invitee is null or invitee <> inviter),
  constraint walk_pairs_open_state  check (status <> 'open' or (invitee is null and accepted_at is null)),
  constraint walk_pairs_acc_state   check (status <> 'accepted' or (invitee is not null and accepted_at is not null and invitee_alias is not null))
);
create index walk_pairs_inviter_idx on public.walk_pairs (inviter);
create index walk_pairs_invitee_idx on public.walk_pairs (invitee);

create or replace function public.walk_pairs_cap()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.walk_pairs where inviter = new.inviter and status = 'open' and expires_at > now()) >= 10
     or (select count(*) from public.walk_pairs where inviter = new.inviter) >= 50 then
    raise exception 'walk_pairs: too many invites' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.walk_pairs_cap() from public, anon, authenticated;
create trigger trg_walk_pairs_cap before insert on public.walk_pairs
  for each row execute function public.walk_pairs_cap();

alter table public.walk_pairs enable row level security;
revoke all on public.walk_pairs from anon, authenticated;
grant select, delete on public.walk_pairs to authenticated;
grant insert (inviter, inviter_alias) on public.walk_pairs to authenticated;     -- 토큰·상태·만료는 정할 수 없다(기본값). 수락·끝내기는 아래 함수로만.
revoke truncate, references, trigger on public.walk_pairs from authenticated;
create policy "walk_pairs read own"   on public.walk_pairs for select to authenticated
  using (inviter = (select auth.uid()) or invitee = (select auth.uid()));
create policy "walk_pairs insert own" on public.walk_pairs for insert to authenticated
  with check (inviter = (select auth.uid()));
create policy "walk_pairs delete own" on public.walk_pairs for delete to authenticated
  using (inviter = (select auth.uid()) or invitee = (select auth.uid()));

-- 4) 초대 링크 미리보기 — 로그인 전 화면에서 "○○님이 같이 걷기를 초대했어요"를 보여 준다. 토큰을 아는 사람에게 별칭과 유효 여부만 알려 준다.
create or replace function public.walk_invite_info(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('valid', true, 'alias', inviter_alias, 'expires_at', expires_at)
       from public.walk_pairs where token = p_token and status = 'open' and expires_at > now()),
    jsonb_build_object('valid', false))
$$;
revoke all on function public.walk_invite_info(text) from public;
grant execute on function public.walk_invite_info(text) to anon, authenticated;

-- 5) 초대 수락 — 로그인한 사람이 내 별칭을 정해 수락. 본인 초대·이미 쓰인 초대·만료된 초대는 모두 같은 'invalid'(자기 초대만 'self')
create or replace function public.walk_accept(p_token text, p_alias text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr public.walk_pairs; al text := btrim(coalesce(p_alias, ''));
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if char_length(al) < 1 or char_length(al) > 20 then return jsonb_build_object('ok', false, 'reason', 'bad_alias'); end if;
  select * into pr from public.walk_pairs where token = p_token for update;
  if not found or pr.status <> 'open' or pr.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if pr.inviter = me then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  update public.walk_pairs set invitee = me, invitee_alias = al, status = 'accepted', accepted_at = now() where id = pr.id;
  return jsonb_build_object('ok', true, 'pair', pr.id, 'alias', pr.inviter_alias);
end $$;
revoke all on function public.walk_accept(text, text) from public, anon;
grant execute on function public.walk_accept(text, text) to authenticated;

-- 6) 같이 걷기 끝내기 — 짝의 어느 쪽이든. 끝나면 서로의 배열을 즉시 읽지 못한다(내 배열 자체는 walk_flows 행을 지워 거둔다).
create or replace function public.walk_revoke(p_pair uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer;
begin
  if me is null then return false; end if;
  update public.walk_pairs set status = 'revoked'
   where id = p_pair and status <> 'revoked' and (inviter = me or invitee = me);
  get diagnostics n = row_count; return n > 0;
end $$;
revoke all on function public.walk_revoke(uuid) from public, anon;
grant execute on function public.walk_revoke(uuid) to authenticated;

-- 7) 내 짝 목록 — 수락된 짝만. 상대 별칭과 상대가 허용을 켰는지만 알려 준다.
create or replace function public.walk_partners()
returns table(pair_id uuid, alias text, other_on boolean, accepted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id,
         case when p.inviter = auth.uid() then p.invitee_alias else p.inviter_alias end,
         exists (select 1 from public.walk_flows w where w.user_id = case when p.inviter = auth.uid() then p.invitee else p.inviter end),
         p.accepted_at
  from public.walk_pairs p
  where p.status = 'accepted' and auth.uid() in (p.inviter, p.invitee)
  order by p.accepted_at desc
$$;
revoke all on function public.walk_partners() from public, anon;
grant execute on function public.walk_partners() to authenticated;

-- 8) 둘의 배열 읽기 — 내가 속한 수락된 짝이고 둘 다 허용을 켰을 때만. 두 사람의 (거친) 배열과 별칭만 돌려준다. 생일·사주는 응답에 없다.
--    실패 이유: 'unavailable'(내 짝이 아님·수락 전·끝남) / 'me_off'(내가 허용을 안 켬) / 'other_off'(상대가 허용을 안 켬)
create or replace function public.walk_pair(p_pair uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); pr public.walk_pairs; other uuid; m public.walk_flows; o public.walk_flows; myal text; otal text;
begin
  if me is null or p_pair is null then return jsonb_build_object('ok', false, 'reason', 'unavailable'); end if;
  select * into pr from public.walk_pairs where id = p_pair;
  if not found or pr.status <> 'accepted' or me not in (pr.inviter, pr.invitee) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  other := case when pr.inviter = me then pr.invitee else pr.inviter end;
  myal  := case when pr.inviter = me then pr.inviter_alias else pr.invitee_alias end;
  otal  := case when pr.inviter = me then pr.invitee_alias else pr.inviter_alias end;
  select * into m from public.walk_flows where user_id = me;
  if not found then return jsonb_build_object('ok', false, 'reason', 'me_off'); end if;
  select * into o from public.walk_flows where user_id = other;
  if not found then return jsonb_build_object('ok', false, 'reason', 'other_off'); end if;
  return jsonb_build_object('ok', true,
    'me',    jsonb_build_object('from', m.from_year, 'net2', to_jsonb(m.net2), 'tones', m.tones, 'v', m.calc_version, 'alias', myal),
    'other', jsonb_build_object('from', o.from_year, 'net2', to_jsonb(o.net2), 'tones', o.tones, 'v', o.calc_version, 'alias', otal));
end $$;
revoke all on function public.walk_pair(uuid) from public, anon;
grant execute on function public.walk_pair(uuid) to authenticated;
