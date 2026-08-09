-- =====================================================================
-- PASSO 1 di 2 — La parola d'ordine delle notifiche entra nel Vault
-- =====================================================================
-- Eccezione dichiarata alla regola "diagnostica = sola lettura": questo
-- file SCRIVE due valori nel Vault (l'archivio cifrato dentro Postgres).
-- Sta qui e non fra le migrazioni perche' va eseguito PRIMA del deploy
-- della funzione, e non cambia il comportamento di nulla: la catena
-- delle notifiche continua a funzionare come adesso finche' non si
-- applica la migrazione del passo 2.
--
-- Cosa mette nel Vault:
--   notifiche_firma  — parola d'ordine casuale (64 caratteri) che d'ora in
--                      poi il database allega a ogni chiamata alla Edge
--                      Function. Non esiste da nessun'altra parte: NON e'
--                      nel repository, non e' in questo file, viene
--                      generata qui al momento.
--   chiave_anon      — la chiave pubblica dell'app, oggi copiata a mano
--                      dentro due funzioni: se un giorno venisse ruotata,
--                      prenotazioni e promemoria si spegnerebbero in
--                      silenzio. Da qui in avanti si cambia in un posto solo.
--
-- Rieseguibile: se i valori esistono gia', NON li rigenera (rigenerarli
-- scollegherebbe database e funzione online).

do $$
declare
  v_firma text;
begin
  if not exists (select 1 from vault.secrets where name = 'notifiche_firma') then
    -- 64 caratteri esadecimali senza dipendere da estensioni aggiuntive.
    v_firma := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    perform vault.create_secret(
      v_firma,
      'notifiche_firma',
      'Parola d''ordine condivisa fra il database e la Edge Function delle notifiche Telegram (blindatura 09/08/2026).'
    );
    raise notice 'Parola d''ordine creata.';
  else
    raise notice 'Parola d''ordine gia'' presente: lasciata invariata.';
  end if;

  if not exists (select 1 from vault.secrets where name = 'chiave_anon') then
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGp1cWJxc3ppc2R0d3pieGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDA0MDIsImV4cCI6MjEwMTAxNjQwMn0.Aejkq4VmZdbxw5TbhKmmdg64fvd48BjxapGxKyAjWB4',
      'chiave_anon',
      'Chiave pubblica dell''app (non e'' un segreto: serve a superare la verifica JWT del gateway). Qui per averla in UN posto solo: una rotazione si applica cambiando questa riga.'
    );
    raise notice 'Chiave pubblica archiviata nel Vault.';
  else
    raise notice 'Chiave pubblica gia'' presente nel Vault.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- IL VALORE DA COPIARE NEL PANNELLO
-- ---------------------------------------------------------------------
-- La colonna "parola_ordine" va incollata nei Secrets della Edge Function
-- con nome NOTIFICHE_FIRMA. E' l'unica volta che serve leggerla.
select
  decrypted_secret as parola_ordine,
  'Copiala nei Secrets della Edge Function con nome: NOTIFICHE_FIRMA' as cosa_farne
from vault.decrypted_secrets
where name = 'notifiche_firma';
