-- core_profiles · journey_answers 롤백 시험 (초안, 2026-10-22)
-- 사용: supabase-core-profiles.sql 바로 뒤에 붙여 '한 번의 호출'로 실행한다(둘을 합친 supabase-core-profiles-trial.sql 참고).
-- 끝에서 일부러 예외를 던져 DDL까지 통째로 되돌린다. 성공하면 메시지가 'ALL_TESTS_PASSED …'로 나오고, 다른 메시지면 그 자리에서 실패한 것이다.
-- 시험에는 기존 계정 2개의 id와 시험용 임시 계정 1개를 쓰고, 전체가 롤백되므로 아무 것도 남기지 않는다.

do $$
declare
  a uuid; b uuid; c uuid; n integer; ok boolean; done_ integer := 0;
  claims_a text; claims_b text; claims_admin text;
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users where id <> a order by created_at limit 1;
  if a is null or b is null then raise exception 'NEED_2_USERS'; end if;
  claims_a     := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b     := json_build_object('sub', b, 'role', 'authenticated')::text;
  claims_admin := json_build_object('sub', b, 'role', 'authenticated', 'app_metadata', json_build_object('role','admin'))::text;

  -- ── 1. 로그인 없음(anon): 두 표 모두 읽기·쓰기 불가
  set local role anon;
  begin perform count(*) from public.core_profiles; raise exception 'T1a anon read allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin perform count(*) from public.journey_answers; raise exception 'T1b anon read allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  reset role;

  -- ── 2. 본인 저장: A가 자기 행 만들기(동의 포함)
  perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  insert into public.core_profiles(user_id, nickname, gender, birth_y, birth_mo, birth_d, birth_h, birth_min, birth_city, consent_version)
  values (a, '시험', 'female', 1988, 2, 1, 9, 30, '서울', 'v1');
  select count(*) into n from public.core_profiles; if n <> 1 then raise exception 'T2 own select %', n; end if; done_ := done_ + 1;

  -- ── 3. A가 B 이름으로 넣기 → 규칙 위반
  begin insert into public.core_profiles(user_id, birth_y, birth_mo, birth_d, consent_version) values (b, 1990, 1, 1, 'v1');
    raise exception 'T3 insert for other allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 4. 값 검사: 동의 문구 빈 값 / 연도 범위 / 성별 값 / 윤달+양력 / 시간 모름+시각
  begin insert into public.core_profiles(user_id, birth_y, birth_mo, birth_d, consent_version) values (a, 1990, 1, 1, '');
    raise exception 'T4a empty consent allowed'; exception when check_violation or unique_violation then done_ := done_ + 1; end;
  begin update public.core_profiles set birth_y = 1800 where user_id = a; raise exception 'T4b year range allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.core_profiles set gender = 'x' where user_id = a; raise exception 'T4c gender allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.core_profiles set leap = true where user_id = a; raise exception 'T4d leap on solar allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.core_profiles set time_unknown = true where user_id = a; raise exception 'T4e unknown time with hour allowed';
  exception when check_violation then done_ := done_ + 1; end;

  -- ── 5. 본인 수정 OK + updated_at 갱신, user_id 바꿔치기 불가
  perform pg_sleep(0.01);
  update public.core_profiles set nickname = '시험2' where user_id = a;
  select (updated_at > created_at) into ok from public.core_profiles where user_id = a; if not ok then raise exception 'T5a updated_at'; end if; done_ := done_ + 1;
  begin update public.core_profiles set user_id = b where user_id = a; raise exception 'T5b user_id change allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 6. 걷기 답: 정상 / 범위 밖 점수 / 같은 해 두 번 / 메모 길이
  insert into public.journey_answers(user_id, year, score, memo, tag) values (a, 2015, 3, '이직', '변화가 큰 해');
  begin insert into public.journey_answers(user_id, year, score) values (a, 2016, 6); raise exception 'T6a score 6 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.journey_answers(user_id, year, score) values (a, 2015, 1); raise exception 'T6b duplicate year allowed';
  exception when unique_violation then done_ := done_ + 1; end;
  begin insert into public.journey_answers(user_id, year, score, memo) values (a, 2017, 1, repeat('가', 41)); raise exception 'T6c long memo allowed';
  exception when check_violation then done_ := done_ + 1; end;
  insert into public.journey_answers(user_id, year, score) values (a, 2015, -2)
    on conflict (user_id, year) do update set score = excluded.score;     -- 앱이 쓸 '다시 답하기'(upsert)
  select score into n from public.journey_answers where user_id = a and year = 2015; if n <> -2 then raise exception 'T6d upsert %', n; end if; done_ := done_ + 1;
  begin insert into public.journey_answers(user_id, year, score) values (b, 2020, 1); raise exception 'T6e insert for other allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 7. 다른 사람(B)과 관리자는 A의 행을 못 본다
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  select count(*) into n from public.core_profiles   where user_id = a; if n <> 0 then raise exception 'T7a B sees A profile'; end if;
  select count(*) into n from public.journey_answers where user_id = a; if n <> 0 then raise exception 'T7b B sees A answers'; end if;
  update public.core_profiles set nickname = '침입' where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T7c B updated A'; end if;
  delete from public.journey_answers where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T7d B deleted A answers'; end if;
  done_ := done_ + 4;
  reset role; perform set_config('request.jwt.claims', claims_admin, true); set local role authenticated;
  select count(*) into n from public.core_profiles   where user_id = a; if n <> 0 then raise exception 'T7e admin sees profile'; end if;
  select count(*) into n from public.journey_answers where user_id = a; if n <> 0 then raise exception 'T7f admin sees answers'; end if;
  done_ := done_ + 2;

  -- ── 8. TRUNCATE 불가
  begin truncate public.core_profiles; raise exception 'T8a truncate allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;
  begin truncate public.journey_answers; raise exception 'T8b truncate allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 9. 본인 삭제(동의 철회) OK — 걷기 답은 남는다
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  delete from public.core_profiles where user_id = a; get diagnostics n = row_count; if n <> 1 then raise exception 'T9a own delete %', n; end if;
  select count(*) into n from public.journey_answers where user_id = a; if n <> 1 then raise exception 'T9b answers kept %', n; end if;
  done_ := done_ + 2;

  -- ── 10. 계정 탈퇴(auth.users 삭제)하면 두 표가 함께 비워진다
  --   실제 회원을 지우면 다른 앱 표의 제약에 걸릴 수 있어, 시험용 임시 계정을 만들어 지운다(전체가 롤백되므로 남지 않는다).
  reset role;
  c := gen_random_uuid();
  insert into auth.users(id, aud, role, email) values (c, 'authenticated', 'authenticated', 'trial-' || c || '@example.invalid');
  insert into public.core_profiles(user_id, birth_y, birth_mo, birth_d, consent_version) values (c, 1988, 2, 1, 'v1');
  insert into public.journey_answers(user_id, year, score) values (c, 2015, 1);
  delete from auth.users where id = c;
  select count(*) into n from public.core_profiles   where user_id = c; if n <> 0 then raise exception 'T10a cascade profile'; end if;
  select count(*) into n from public.journey_answers where user_id = c; if n <> 0 then raise exception 'T10b cascade answers'; end if;
  done_ := done_ + 2;

  raise exception 'ALL_TESTS_PASSED % checks (이 예외는 DDL까지 통째로 되돌리려는 의도)', done_;
end $$;
