-- tier_of(uid) 를 API(/rest/v1/rpc)에서 숨긴다 (2026-11-22 보안 점검).
-- 전: 로그인한 누구나 남의 등급을 rpc 로 물어볼 수 있었음.
-- 후: 같은 함수를 노출되지 않는 스키마(jalim_private)에 두고, likes·messages 쓰기 규칙만 그것을 쓴다.
--     public.tier_of 는 지우지 않고 실행 권한만 거둔다(되돌리기 쉽게).

create schema if not exists jalim_private;
revoke all on schema jalim_private from public, anon;
grant usage on schema jalim_private to authenticated;

create or replace function jalim_private.tier_of(uid uuid)
returns smallint language sql stable security definer set search_path = public
as $$ select coalesce((select tier from public.profiles where id = uid), 1::smallint) $$;
revoke all on function jalim_private.tier_of(uuid) from public, anon;
grant execute on function jalim_private.tier_of(uuid) to authenticated;

alter policy "likes insert own" on public.likes
  with check ((auth.uid() = from_id) and (my_tier() = 2) and (jalim_private.tier_of(to_id) = 2));
alter policy "messages insert own" on public.messages
  with check ((auth.uid() = from_id) and (not is_blocked(from_id, to_id)) and (my_tier() = 2) and (jalim_private.tier_of(to_id) = 2));

revoke execute on function public.tier_of(uuid) from public, anon, authenticated;

-- 되돌리기:
-- grant execute on function public.tier_of(uuid) to anon, authenticated;
-- alter policy "likes insert own" on public.likes with check ((auth.uid() = from_id) and (my_tier() = 2) and (tier_of(to_id) = 2));
-- alter policy "messages insert own" on public.messages with check ((auth.uid() = from_id) and (not is_blocked(from_id, to_id)) and (my_tier() = 2) and (tier_of(to_id) = 2));
-- drop schema jalim_private cascade;
