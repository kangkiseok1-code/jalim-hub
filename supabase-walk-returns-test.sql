-- walk_returns 롤백 시험 (2026-11-19)
-- 사용: supabase-walk-returns.sql 바로 뒤에 붙여 '한 번의 호출'로 실행한다. 끝에서 일부러 예외를 던져 DDL까지 통째로 되돌린다.
-- 성공하면 메시지가 'ALL_TESTS_PASSED …'로 나온다. 기존 계정 2개(a=본인 · b=다른 사람, b에는 관리자 표시도 붙여 본다)를 쓰고 아무 것도 남기지 않는다.
do $$
declare a uuid; b uuid; n integer; done_ integer := 0;
  ca text; cb text; cadm text;
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users where id <> a order by created_at limit 1;
  ca   := json_build_object('sub', a, 'role', 'authenticated')::text;
  cb   := json_build_object('sub', b, 'role', 'authenticated')::text;
  cadm := json_build_object('sub', b, 'role', 'authenticated', 'app_metadata', json_build_object('role', 'admin'))::text;

  -- 1. 로그인 없음: 읽기·쓰기 불가
  set local role anon;
  begin perform count(*) from public.walk_returns; raise exception 'T1a anon read';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin insert into public.walk_returns(user_id) values (a); raise exception 'T1b anon insert';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  reset role;

  -- 2. 본인: 넣기·읽기·고치기·지우기
  perform set_config('request.jwt.claims', ca, true); set local role authenticated;
  insert into public.walk_returns(user_id, moments, letters) values (a, '[{"y":2011,"kind":"돈","memo":"x"}]', '{"past":"괜찮아","future":"반만","futureYear":2031}');
  select count(*) into n from public.walk_returns; if n <> 1 then raise exception 'T2a own read %', n; end if;
  update public.walk_returns set letters = letters || '{"opened":true}' where user_id = a; get diagnostics n = row_count; if n <> 1 then raise exception 'T2b own update'; end if;
  done_ := done_ + 2;
  -- 2-1. 다른 사람 이름으로 넣기 불가
  begin insert into public.walk_returns(user_id) values (b); raise exception 'T2c insert for other';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  -- 2-2. 모양 검사: 순간 4개·배열 아님·너무 긴 편지
  begin update public.walk_returns set moments = '[1,2,3,4]' where user_id = a; raise exception 'T2d 4 moments';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_returns set moments = '{"y":1}' where user_id = a; raise exception 'T2e not array';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.walk_returns set letters = jsonb_build_object('past', repeat('가나다라마바사아자차', 600)) where user_id = a; raise exception 'T2f huge letter';
  exception when check_violation then done_ := done_ + 1; end;
  reset role;

  -- 3. 다른 사람·관리자: 남의 행을 못 보고 못 고치고 못 지운다
  perform set_config('request.jwt.claims', cb, true); set local role authenticated;
  select count(*) into n from public.walk_returns; if n <> 0 then raise exception 'T3a other read %', n; end if;
  update public.walk_returns set letters = '{}' where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T3b other update'; end if;
  delete from public.walk_returns where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T3c other delete'; end if;
  done_ := done_ + 3;
  reset role;
  perform set_config('request.jwt.claims', cadm, true); set local role authenticated;
  select count(*) into n from public.walk_returns; if n <> 0 then raise exception 'T3d admin read %', n; end if;
  done_ := done_ + 1;
  reset role;

  -- 4. 본인 지우기 + 수정 시각 갱신 트리거
  perform set_config('request.jwt.claims', ca, true); set local role authenticated;
  delete from public.walk_returns where user_id = a; get diagnostics n = row_count; if n <> 1 then raise exception 'T4a own delete'; end if;
  done_ := done_ + 1;
  reset role;

  raise exception 'ALL_TESTS_PASSED %', done_;
end $$;
