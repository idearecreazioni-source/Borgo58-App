-- =====================================================================
-- SETUP UTENTI DI PROVA per `npm run test:app` — SCRIVE in user_roles
-- =====================================================================
-- Eccezione dichiarata alla regola "diagnostica = sola lettura": questo
-- file assegna il ruolo ai due utenti di PROVA delle verifiche
-- automatiche. user_roles e' modificabile solo via SQL per progettazione
-- (lo staff non puo' auto-promuoversi), quindi il passaggio e' questo.
--
-- PRIMA di eseguirlo: creare i due utenti dalla dashboard
-- (Authentication -> Users -> Add user):
--   test-titolare@borgo58.app
--   test-staff@borgo58.app
--
-- Rieseguibile senza danni.

do $$
declare
  v_tit uuid;
  v_staff uuid;
begin
  select id into v_tit from auth.users where email = 'test-titolare@borgo58.app';
  select id into v_staff from auth.users where email = 'test-staff@borgo58.app';

  if v_tit is null or v_staff is null then
    raise exception 'Creare prima i due utenti di prova dalla dashboard (Authentication -> Users): test-titolare@borgo58.app e test-staff@borgo58.app.';
  end if;

  insert into user_roles (user_id, role) values (v_tit, 'titolare')
  on conflict (user_id) do update set role = 'titolare';
  insert into user_roles (user_id, role) values (v_staff, 'staff')
  on conflict (user_id) do update set role = 'staff';

  raise notice 'Utenti di prova pronti: test-titolare (ruolo titolare) e test-staff (ruolo staff).';
end $$;

-- Riepilogo: devono comparire 4 righe (i 2 account veri + i 2 di prova).
select u.email, r.role
from user_roles r
join auth.users u on u.id = r.user_id
order by u.email;
