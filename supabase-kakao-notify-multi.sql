-- 카카오 알림 받는 사람을 여러 명으로 — 표를 '한 줄(id=1)'에서 '사람마다 한 줄(user_id)'로.
-- 기존 한 줄(관리자 kangkaru1)은 그 사람 줄로 옮긴다. 읽기·쓰기는 여전히 서버 함수(서비스 키)만(RLS 잠금 유지).
alter table public.kakao_notify drop constraint if exists kakao_notify_id_check;
alter table public.kakao_notify add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.kakao_notify
   set user_id = (select id from auth.users where email = 'kangkaru1@naver.com')
 where user_id is null;
alter table public.kakao_notify drop constraint if exists kakao_notify_pkey;
alter table public.kakao_notify drop column if exists id;
alter table public.kakao_notify alter column user_id set not null;
alter table public.kakao_notify add primary key (user_id);
