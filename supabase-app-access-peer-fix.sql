-- 자림 앱 입장 승인제 — 4-4 보정: 지인 평가 응답을 다시 받는다 (심화상담 공개 지인 평가 페이지 #peer)
-- ✅ 상태: **2026-10-22 실제 DB에 적용됨**(마이그레이션 app_access_peer_insert_fix). 적용 전 롤백 시험 → 적용 → 적용 후 같은 시험을 다시 해 결과가 같음을 확인했다.
--
-- 왜 필요한가: 심화상담의 지인 평가 응답은 submissions 표에 client_id=null, data.kind='peer' 로 저장된다
-- (counsel-tool/index.html, 지인이 가입 없이 답함 — 가입 없이 유지하기로 한 결정).
-- 4-4(supabase-app-access-tighten.sql)가 submissions 넣기를 '승인된 회원 본인 이름'으로만 바꾸고 anon 권한을 전부 거둬서
-- 이 응답 저장이 막혔다. (4-4 시험에서 peer_reviews 표(만남용)만 확인하고 submissions 의 지인 응답은 빠뜨림)
--
-- 보정 내용: 지인 평가 행에 한해서만 넣기를 다시 연다.
--   · client_id 가 비어 있고(본인 이름 위조 불가), data.kind='peer' 이며 data.token 이 있는 행만
--   · 로그인 없는 사람(anon)과 로그인했지만 승인 전인 사람(authenticated) 모두 — 응답하는 지인은 승인 대상이 아님
--   · 읽기·수정·삭제는 여전히 anon 불가. 내담자 본인이 토큰으로 집계를 읽는 get_peer_by_token 함수는 그대로 동작.
grant insert on public.submissions to anon;

create policy "submissions insert peer" on public.submissions
  for insert to anon, authenticated
  with check ( client_id is null and data->>'kind' = 'peer' and coalesce(data->>'token','') <> '' );

-- 되돌리기(보정 취소): drop policy "submissions insert peer" on public.submissions; revoke insert on public.submissions from anon;
