-- walk_flows · walk_pairs · 초대/짝 함수 롤백 시험 (초안 2판, 2026-10-24)
-- 사용: supabase-walk-flows.sql 바로 뒤에 붙여 '한 번의 호출'로 실행한다(둘을 합친 supabase-walk-flows-trial.sql 참고).
-- 끝에서 일부러 예외를 던져 DDL까지 통째로 되돌린다. 성공하면 메시지가 'ALL_TESTS_PASSED …'로 나오고, 다른 메시지면 그 자리에서 실패한 것이다.
-- 시험에는 기존 계정 3개의 id(a=초대하는 사람 · b=수락하는 사람 · d=제3자)와 시험용 임시 계정 1개를 쓰고, 전체가 롤백되므로 아무 것도 남기지 않는다.

do $$
declare
  a uuid; b uuid; d uuid; c uuid; n integer; ok boolean; r jsonb; done_ integer := 0;
  pid uuid; pid2 uuid; pid3 uuid; tok text; tok2 text; tok3 text;
  claims_a text; claims_b text; claims_d text; claims_admin text;
  arr_a smallint[] := array[-2, -5, -3, 0, 1, 2]::smallint[];
  tn_a text := 'bbmgmg';
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users where id <> a order by created_at limit 1;
  select id into d from auth.users where id not in (a, b) order by created_at limit 1;
  if a is null or b is null or d is null then raise exception 'NEED_3_USERS'; end if;
  claims_a     := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b     := json_build_object('sub', b, 'role', 'authenticated')::text;
  claims_d     := json_build_object('sub', d, 'role', 'authenticated')::text;
  claims_admin := json_build_object('sub', d, 'role', 'authenticated', 'app_metadata', json_build_object('role','admin'))::text;

  -- ── 1. 로그인 없음(anon): 표 읽기·쓰기 불가, 함수는 미리보기만 가능
  set local role anon;
  begin perform count(*) from public.walk_flows; raise exception 'T1a anon read flows allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform count(*) from public.walk_pairs; raise exception 'T1b anon read pairs allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform public.walk_pair(gen_random_uuid()); raise exception 'T1c anon walk_pair allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform public.walk_accept('x', 'y'); raise exception 'T1d anon walk_accept allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform public.walk_revoke(gen_random_uuid()); raise exception 'T1e anon walk_revoke allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform * from public.walk_partners(); raise exception 'T1f anon walk_partners allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  r := public.walk_invite_info('no-such-token'); if (r->>'valid')::boolean then raise exception 'T1g bogus token valid'; end if; done_ := done_ + 1;
  reset role;

  -- ── 2. 초대 만들기: A가 별칭으로 초대 → 토큰은 DB가 정한다
  perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  insert into public.walk_pairs(inviter, inviter_alias) values (a, '하늘') returning id, token into pid, tok;
  if char_length(tok) <> 64 then raise exception 'T2a token length %', char_length(tok); end if;
  if (select status from public.walk_pairs where id = pid) <> 'open' or (select source from public.walk_pairs where id = pid) <> 'link' then raise exception 'T2b defaults'; end if;
  done_ := done_ + 2;
  begin insert into public.walk_pairs(inviter, inviter_alias, token) values (a, '하늘', 'my-own-token'); raise exception 'T2c custom token allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin insert into public.walk_pairs(inviter, inviter_alias, status) values (a, '하늘', 'accepted'); raise exception 'T2d custom status allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin insert into public.walk_pairs(inviter, inviter_alias) values (b, '남의 이름으로'); raise exception 'T2e insert for other allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin insert into public.walk_pairs(inviter, inviter_alias) values (a, ''); raise exception 'T2f empty alias allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.walk_pairs(inviter, inviter_alias) values (a, repeat('가', 21)); raise exception 'T2g long alias allowed';
  exception when check_violation then done_ := done_ + 1; end;

  -- ── 3. 열린 초대는 10개까지(11번째 거부)
  for n in 1..9 loop insert into public.walk_pairs(inviter, inviter_alias) values (a, '하늘'); end loop;
  begin insert into public.walk_pairs(inviter, inviter_alias) values (a, '하늘'); raise exception 'T3 11th open invite allowed';
  exception when check_violation then done_ := done_ + 1; end;
  delete from public.walk_pairs where inviter = a and id <> pid;   -- 이후 시험을 위해 정리

  -- ── 4. 수락 전: B·D는 A의 초대 행을 못 본다, 미리보기는 별칭과 유효 여부만
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  select count(*) into n from public.walk_pairs; if n <> 0 then raise exception 'T4a B sees invite %', n; end if;
  r := public.walk_invite_info(tok); if not (r->>'valid')::boolean or r->>'alias' <> '하늘' or r::text ~ '"inviter"|user' then raise exception 'T4b info %', r; end if;
  done_ := done_ + 2;
  reset role; set local role anon;
  r := public.walk_invite_info(tok); if not (r->>'valid')::boolean then raise exception 'T4c anon info %', r; end if; done_ := done_ + 1;
  reset role;

  -- ── 5. 수락: 본인 초대 / 빈 별칭 / 엉뚱한 토큰은 실패, B가 수락하면 짝이 된다
  perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  r := public.walk_accept(tok, '나'); if r->>'reason' <> 'self' then raise exception 'T5a self accept %', r; end if;
  reset role; perform set_config('request.jwt.claims', claims_d, true); set local role authenticated;
  r := public.walk_accept('no-such-token', '제3자'); if r->>'reason' <> 'invalid' then raise exception 'T5b bad token %', r; end if;
  r := public.walk_accept(tok, '   '); if r->>'reason' <> 'bad_alias' then raise exception 'T5c blank alias %', r; end if;
  done_ := done_ + 3;
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_accept(tok, '바다'); if not (r->>'ok')::boolean or (r->>'pair')::uuid <> pid or r->>'alias' <> '하늘' then raise exception 'T5d accept %', r; end if; done_ := done_ + 1;
  reset role; perform set_config('request.jwt.claims', claims_d, true); set local role authenticated;
  r := public.walk_accept(tok, '제3자'); if r->>'reason' <> 'invalid' then raise exception 'T5e reuse token %', r; end if; done_ := done_ + 1;

  -- ── 6. 수락 뒤: A·B는 짝 행을 보고, D는 못 본다. 직접 수정은 못 한다
  select count(*) into n from public.walk_pairs; if n <> 0 then raise exception 'T6a stranger sees pair %', n; end if;
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  select count(*) into n from public.walk_pairs where id = pid; if n <> 1 then raise exception 'T6b B pair %', n; end if;
  begin update public.walk_pairs set status = 'open', invitee = null where id = pid; raise exception 'T6c direct update allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  done_ := done_ + 1;
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  select count(*) into n from public.walk_pairs where id = pid and invitee = b and status = 'accepted'; if n <> 1 then raise exception 'T6d A pair'; end if; done_ := done_ + 1;

  -- ── 7. 만료된 초대·끝낸 초대로는 수락할 수 없다
  insert into public.walk_pairs(inviter, inviter_alias) values (a, '하늘') returning id, token into pid2, tok2;
  insert into public.walk_pairs(inviter, inviter_alias) values (a, '하늘') returning id, token into pid3, tok3;
  reset role; update public.walk_pairs set expires_at = now() - interval '1 day' where id = pid2;
  r := public.walk_invite_info(tok2); if (r->>'valid')::boolean then raise exception 'T7a expired info valid'; end if;
  perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_accept(tok2, '바다'); if r->>'reason' <> 'invalid' then raise exception 'T7b expired accept %', r; end if;
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  if not public.walk_revoke(pid3) then raise exception 'T7c revoke open invite'; end if;
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_accept(tok3, '바다'); if r->>'reason' <> 'invalid' then raise exception 'T7d revoked accept %', r; end if;
  done_ := done_ + 4;

  -- ── 8. 흐름 배열 입력 검사: 빈 배열 / 62개 / 톤 길이 / 톤 글자 / 값 범위 / 연도 / 버전 / null 원소
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  insert into public.walk_flows(user_id, from_year, net2, tones, calc_version, consent_version) values (a, 2020, arr_a, tn_a, 'v1', 'v1');
  begin insert into public.walk_flows(user_id, from_year, net2, tones, calc_version, consent_version) values (b, 2020, arr_a, tn_a, 'v1', 'v1');
    raise exception 'T8a insert for other allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;
  begin update public.walk_flows set net2 = array[]::smallint[], tones = '' where user_id = a; raise exception 'T8b empty allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set net2 = array_fill(0::smallint, array[62]), tones = repeat('m', 62) where user_id = a; raise exception 'T8c 62 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set tones = 'bbmgm' where user_id = a; raise exception 'T8d tones length allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set tones = 'bbmgmx' where user_id = a; raise exception 'T8e tones char allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set net2 = array[-2, -9, -3, 0, 1, 2]::smallint[] where user_id = a; raise exception 'T8f -9 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set net2 = array[-2, 5, -3, 0, 1, 2]::smallint[] where user_id = a; raise exception 'T8g 5 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set from_year = 1800 where user_id = a; raise exception 'T8h year 1800 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set from_year = 2099 where user_id = a; raise exception 'T8i year over 2100 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set calc_version = '' where user_id = a; raise exception 'T8j empty version allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_flows set net2 = array[-2, null, -3, 0, 1, 2]::smallint[] where user_id = a; raise exception 'T8k null element allowed';
  exception when check_violation then done_ := done_ + 1; end;
  perform pg_sleep(0.01);
  update public.walk_flows set net2 = array[-1, -5, -3, 0, 1, 2]::smallint[] where user_id = a;
  select (updated_at > created_at) into ok from public.walk_flows where user_id = a; if not ok then raise exception 'T8l updated_at'; end if; done_ := done_ + 1;
  begin update public.walk_flows set user_id = b where user_id = a; raise exception 'T8m user_id change allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 9. 짝 읽기: 허용 상태별 이유 → 둘 다 켜면 두 사람의 배열과 별칭만(생일 키 없음)
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_pair(pid); if r->>'reason' <> 'me_off' then raise exception 'T9a me_off %', r; end if;
  select count(*) into n from public.walk_partners() where pair_id = pid and alias = '하늘' and other_on; if n <> 1 then raise exception 'T9b partners (A on) %', n; end if;
  insert into public.walk_flows(user_id, from_year, net2, tones, calc_version, consent_version) values (b, 2021, array[0, 1, -2, -3]::smallint[], 'gggb', 'v1', 'v1');
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  delete from public.walk_flows where user_id = a;
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_pair(pid); if r->>'reason' <> 'other_off' then raise exception 'T9c other_off %', r; end if;
  select count(*) into n from public.walk_partners() where pair_id = pid and not other_on; if n <> 1 then raise exception 'T9d partners (A off) %', n; end if;
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  insert into public.walk_flows(user_id, from_year, net2, tones, calc_version, consent_version) values (a, 2020, arr_a, tn_a, 'v1', 'v1');
  r := public.walk_pair(pid);
  if not (r->>'ok')::boolean then raise exception 'T9e pair not ok %', r; end if;
  if (r->'me'->>'from')::int <> 2020 or jsonb_array_length(r->'me'->'net2') <> 6 or r->'me'->>'tones' <> tn_a or r->'me'->>'alias' <> '하늘' then raise exception 'T9f my payload %', r->'me'; end if;
  if (r->'other'->>'from')::int <> 2021 or jsonb_array_length(r->'other'->'net2') <> 4 or r->'other'->>'tones' <> 'gggb' or r->'other'->>'alias' <> '바다' then raise exception 'T9g other payload %', r->'other'; end if;
  if r::text ~ 'birth|user_id|inviter|invitee|token' then raise exception 'T9h leaked field %', r; end if;
  done_ := done_ + 8;
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  r := public.walk_pair(pid); if not (r->>'ok')::boolean or (r->'other'->>'from')::int <> 2020 or r->'other'->>'alias' <> '하늘' then raise exception 'T9i symmetric %', r; end if; done_ := done_ + 1;

  -- ── 10. 제3자(D)와 관리자는 짝 정보도 표도 못 읽는다
  reset role; perform set_config('request.jwt.claims', claims_d, true); set local role authenticated;
  r := public.walk_pair(pid); if (r->>'ok')::boolean or r->>'reason' <> 'unavailable' then raise exception 'T10a stranger pair %', r; end if;
  if public.walk_revoke(pid) then raise exception 'T10b stranger revoke'; end if;
  select count(*) into n from public.walk_partners(); if n <> 0 then raise exception 'T10c stranger partners %', n; end if;
  select count(*) into n from public.walk_flows where user_id in (a, b); if n <> 0 then raise exception 'T10d stranger flows %', n; end if;
  update public.walk_flows set net2 = array[3, 3, 3, 3, 3, 3]::smallint[] where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T10e stranger update'; end if;
  delete from public.walk_pairs where id = pid; get diagnostics n = row_count; if n <> 0 then raise exception 'T10f stranger delete'; end if;
  done_ := done_ + 6;
  reset role; perform set_config('request.jwt.claims', claims_admin, true); set local role authenticated;
  select count(*) into n from public.walk_flows where user_id in (a, b); if n <> 0 then raise exception 'T10g admin flows'; end if;
  select count(*) into n from public.walk_pairs where id = pid; if n <> 0 then raise exception 'T10h admin pairs'; end if;
  done_ := done_ + 2;

  -- ── 11. TRUNCATE 불가
  begin truncate public.walk_flows; raise exception 'T11a truncate flows allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;
  begin truncate public.walk_pairs; raise exception 'T11b truncate pairs allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 12. 끝내기: B가 끝내면 둘 다 즉시 막히고 목록에서 빠진다. 다시 끝내기는 false
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  if not public.walk_revoke(pid) then raise exception 'T12a revoke'; end if;
  r := public.walk_pair(pid); if (r->>'ok')::boolean or r->>'reason' <> 'unavailable' then raise exception 'T12b B after revoke %', r; end if;
  select count(*) into n from public.walk_partners(); if n <> 0 then raise exception 'T12c B partners %', n; end if;
  if public.walk_revoke(pid) then raise exception 'T12d revoke twice'; end if;
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  r := public.walk_pair(pid); if (r->>'ok')::boolean or r->>'reason' <> 'unavailable' then raise exception 'T12e A after revoke %', r; end if;
  select count(*) into n from public.walk_flows; if n <> 1 then raise exception 'T12f own flows kept %', n; end if;
  done_ := done_ + 6;

  -- ── 13. 본인 지우기: 짝 행 삭제(A) OK, 허용 끄기(행 삭제) OK
  delete from public.walk_pairs where id = pid; get diagnostics n = row_count; if n <> 1 then raise exception 'T13a own pair delete %', n; end if;
  delete from public.walk_flows where user_id = a; get diagnostics n = row_count; if n <> 1 then raise exception 'T13b own flows delete %', n; end if;
  done_ := done_ + 2;

  -- ── 14. 계정 탈퇴(auth.users 삭제)하면 흐름·내가 만든 초대·내가 수락한 짝이 함께 비워진다
  --   실제 회원을 지우면 다른 앱 표의 제약에 걸릴 수 있어, 시험용 임시 계정을 만들어 지운다(전체가 롤백되므로 남지 않는다).
  reset role;
  c := gen_random_uuid();
  insert into auth.users(id, aud, role, email) values (c, 'authenticated', 'authenticated', 'trial-' || c || '@example.invalid');
  insert into public.walk_flows(user_id, from_year, net2, tones, calc_version, consent_version) values (c, 2020, array[0]::smallint[], 'm', 'v1', 'v1');
  insert into public.walk_pairs(inviter, inviter_alias) values (c, '임시');
  insert into public.walk_pairs(inviter, invitee, status, inviter_alias, invitee_alias, accepted_at) values (a, c, 'accepted', '하늘', '임시', now());
  delete from auth.users where id = c;
  select count(*) into n from public.walk_flows where user_id = c; if n <> 0 then raise exception 'T14a cascade flows'; end if;
  select count(*) into n from public.walk_pairs where inviter = c or invitee = c; if n <> 0 then raise exception 'T14b cascade pairs'; end if;
  done_ := done_ + 2;

  raise exception 'ALL_TESTS_PASSED % checks (이 예외는 DDL까지 통째로 되돌리려는 의도)', done_;
end $$;
