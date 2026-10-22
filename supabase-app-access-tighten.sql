-- (2026-10-22 실제 DB 적용: app_access_tighten_counsel_tables. 적용 전 롤백 시험으로 역할별 접근 확인)
-- 자림 앱 입장 승인제 — 4-4 (DB 규칙 조이기, 심화상담 데이터만)
-- 4-1(supabase-app-access.sql)이 먼저 적용돼 있어야 한다. 이 파일을 적용하면 승인 없이는 상담 기록을 쓰거나 읽을 수 없다.
-- 만남(peer_reviews 표)·재물운·팀메이커는 건드리지 않는다.
-- ⚠ 주의(2026-10-22 발견): 심화상담의 지인 평가 응답은 submissions 표(client_id=null, data.kind='peer')에 저장되므로 이 파일의
--   '넣기' 규칙에 막혔다. 보정: supabase-app-access-peer-fix.sql (2026-10-22 적용됨).

-- 1) 상담 기록 consultations — 본인 것 + 입장 승인된 사람만(관리자는 항상 통과)
drop policy "own consultations" on public.consultations;
create policy "own consultations approved" on public.consultations
  for all to authenticated
  using      (counselor_id = (select auth.uid()) and (select public.has_app_access('counsel')))
  with check (counselor_id = (select auth.uid()) and (select public.has_app_access('counsel')));

-- 2) 내담자 제출 submissions
--   · 넣기: 로그인한 승인 회원이 본인 이름으로만 (익명 제출 폐지). 기존 익명 제출 10건은 그대로 남고 관리자가 계속 읽는다.
--   · 읽기·관리자 수정: 기존 규칙 유지
drop policy "submissions insert" on public.submissions;
create policy "submissions insert approved" on public.submissions
  for insert to authenticated
  with check (client_id = (select auth.uid()) and (select public.has_app_access('counsel')));

-- 3) 불필요한 표 권한 회수 — RLS가 지켜주지 않는 TRUNCATE 등과, 로그인 없는 역할의 모든 권한
revoke all on public.consultations from anon;
revoke all on public.submissions   from anon;
revoke truncate, references, trigger on public.consultations from authenticated;
revoke truncate, references, trigger on public.submissions   from authenticated;
