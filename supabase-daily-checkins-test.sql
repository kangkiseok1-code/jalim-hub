-- daily_checkins 롤백 시험 (초안, 2026-10-23)
-- 사용: supabase-daily-checkins.sql 바로 뒤에 붙여 '한 번의 호출'로 실행한다(둘을 합친 supabase-daily-checkins-trial.sql 참고).
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

  -- ── 1. 로그인 없음(anon): 읽기·쓰기 불가
  set local role anon;
  begin perform count(*) from public.daily_checkins; raise exception 'T1a anon read allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  begin insert into public.daily_checkins(user_id, day, mood) values (a, current_date, 1); raise exception 'T1b anon insert allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;
  reset role;

  -- ── 2. 본인 기록: A가 오늘 기분 남기기
  perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  insert into public.daily_checkins(user_id, day, mood, memo, tag) values (a, current_date, 1, '점심이 좋았다', '쉼');
  select count(*) into n from public.daily_checkins; if n <> 1 then raise exception 'T2 own select %', n; end if; done_ := done_ + 1;

  -- ── 3. A가 B 이름으로 넣기 → 규칙 위반
  begin insert into public.daily_checkins(user_id, day, mood) values (b, current_date, 0); raise exception 'T3 insert for other allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 4. 값 검사: 기분 범위 / 메모 길이 / 칩 길이 / 너무 먼 과거
  begin insert into public.daily_checkins(user_id, day, mood) values (a, current_date - 1, 3); raise exception 'T4a mood 3 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.daily_checkins(user_id, day, mood) values (a, current_date - 1, -3); raise exception 'T4b mood -3 allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.daily_checkins(user_id, day, mood, memo) values (a, current_date - 1, 0, repeat('가', 41)); raise exception 'T4c long memo allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.daily_checkins(user_id, day, mood, tag) values (a, current_date - 1, 0, repeat('가', 21)); raise exception 'T4d long tag allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin insert into public.daily_checkins(user_id, day, mood) values (a, date '2019-12-31', 0); raise exception 'T4e ancient day allowed';
  exception when check_violation then done_ := done_ + 1; end;
  insert into public.daily_checkins(user_id, day, mood, memo) values (a, current_date - 1, 0, repeat('가', 40));   -- 40자는 허용
  done_ := done_ + 1;

  -- ── 5. 미래 날짜: 내일까지는 허용(시차), 그 뒤는 거부, 수정으로 미래로 옮기기도 거부
  insert into public.daily_checkins(user_id, day, mood) values (a, current_date + 1, 2); done_ := done_ + 1;
  begin insert into public.daily_checkins(user_id, day, mood) values (a, current_date + 2, 2); raise exception 'T5a future day allowed';
  exception when check_violation then done_ := done_ + 1; end;
  begin update public.daily_checkins set day = current_date + 30 where user_id = a and day = current_date - 1; raise exception 'T5b move to future allowed';
  exception when check_violation then done_ := done_ + 1; end;

  -- ── 6. 같은 날 두 번 → 중복 거부, 앱이 쓸 '고쳐 쓰기'(upsert)는 OK + updated_at 갱신
  begin insert into public.daily_checkins(user_id, day, mood) values (a, current_date, -1); raise exception 'T6a duplicate day allowed';
  exception when unique_violation then done_ := done_ + 1; end;
  perform pg_sleep(0.01);
  insert into public.daily_checkins(user_id, day, mood, memo) values (a, current_date, 2, '바꿔 씀')
    on conflict (user_id, day) do update set mood = excluded.mood, memo = excluded.memo;
  select mood into n from public.daily_checkins where user_id = a and day = current_date; if n <> 2 then raise exception 'T6b upsert %', n; end if;
  select (updated_at > created_at) into ok from public.daily_checkins where user_id = a and day = current_date; if not ok then raise exception 'T6c updated_at'; end if;
  done_ := done_ + 2;
  begin update public.daily_checkins set user_id = b where user_id = a and day = current_date; raise exception 'T6d user_id change allowed';
  exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 7. 다른 사람(B)과 관리자는 A의 기록을 못 본다·못 바꾼다
  reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
  select count(*) into n from public.daily_checkins where user_id = a; if n <> 0 then raise exception 'T7a B sees A rows'; end if;
  update public.daily_checkins set mood = -2 where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T7b B updated A'; end if;
  delete from public.daily_checkins where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'T7c B deleted A'; end if;
  done_ := done_ + 3;
  reset role; perform set_config('request.jwt.claims', claims_admin, true); set local role authenticated;
  select count(*) into n from public.daily_checkins where user_id = a; if n <> 0 then raise exception 'T7d admin sees rows'; end if;
  done_ := done_ + 1;

  -- ── 8. TRUNCATE 불가
  begin truncate public.daily_checkins; raise exception 'T8 truncate allowed'; exception when insufficient_privilege then done_ := done_ + 1; end;

  -- ── 9. 본인 삭제 OK (기록 하루 지우기)
  reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
  delete from public.daily_checkins where user_id = a and day = current_date; get diagnostics n = row_count; if n <> 1 then raise exception 'T9a own delete %', n; end if;
  delete from public.daily_checkins where user_id = a; get diagnostics n = row_count; if n <> 2 then raise exception 'T9b delete all mine %', n; end if;   -- 허브 '기운 기록 지우기'
  done_ := done_ + 2;

  -- ── 10. 계정 탈퇴(auth.users 삭제)하면 기록도 함께 비워진다
  --   실제 회원을 지우면 다른 앱 표의 제약에 걸릴 수 있어, 시험용 임시 계정을 만들어 지운다(전체가 롤백되므로 남지 않는다).
  reset role;
  c := gen_random_uuid();
  insert into auth.users(id, aud, role, email) values (c, 'authenticated', 'authenticated', 'trial-' || c || '@example.invalid');
  insert into public.daily_checkins(user_id, day, mood) values (c, current_date, 1);
  delete from auth.users where id = c;
  select count(*) into n from public.daily_checkins where user_id = c; if n <> 0 then raise exception 'T10 cascade'; end if;
  done_ := done_ + 1;

  raise exception 'ALL_TESTS_PASSED % checks (이 예외는 DDL까지 통째로 되돌리려는 의도)', done_;
end $$;
