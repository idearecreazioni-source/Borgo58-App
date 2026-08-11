-- ---------------------------------------------------------------------
-- La chiave di servizio può scrivere SOLO le due tabelle della posta
-- ---------------------------------------------------------------------
-- Trovato dal vivo alla prima consegna vera, il 12/08/2026: la funzione
-- che riceve la posta rispondeva `42501 — permission denied for table
-- posta_ricevuta`.
--
-- Non era un difetto della funzione. In questo progetto il ruolo di
-- servizio **non ha mai avuto accesso a nessuna tabella**: su tutte —
-- `reservations`, `documents`, e ora anche queste — ha solo i permessi
-- di contorno (`Dxtm`), mai lettura e scrittura. È coerente con la scelta
-- di §4: la chiave di servizio non è mai stata usata da niente, quindi
-- nessuno gliel'ha mai concesso niente.
--
-- La funzione della posta è la **prima cosa del progetto che ne ha
-- bisogno**, e per una ragione che vale la pena avere scritta: un webhook
-- non ha un utente. Non c'è un token di Alessio da inoltrare, perché a
-- bussare è un servizio esterno. O si usa il ruolo di servizio, o si apre
-- una funzione al ruolo anonimo — che è la strada peggiore.
--
-- Quindi: accesso concesso, ma **solo a queste due tabelle**. La
-- verifica in fondo controlla anche il contrario, cioè che il ruolo di
-- servizio NON abbia guadagnato accesso alle tabelle dei soldi: la
-- differenza fra un permesso stretto e un permesso comodo è tutta lì, e
-- fra sei mesi non sarà più evidente a nessuno.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

grant select, insert, update on posta_ricevuta to service_role;
grant select, insert on posta_allegati to service_role;

comment on table posta_ricevuta is
  'La posta del locale, in attesa di una decisione. Solo il titolare la vede. La chiave di servizio puo'' leggerla e scriverla perche'' la riempie un webhook, che non ha un utente da impersonare: e'' l''unica tabella (con posta_allegati) dove quel ruolo ha accesso.';

do $verifica$
declare
  n integer := 0;
  t text;
begin
  -- Ciò che serve, c'è.
  if not has_table_privilege('service_role', 'posta_ricevuta', 'insert') then
    raise exception 'Il servizio non puo'' registrare la posta in arrivo.';
  end if;
  if not has_table_privilege('service_role', 'posta_ricevuta', 'update') then
    raise exception 'Il servizio non puo'' scrivere la proposta dell''AI.';
  end if;
  if not has_table_privilege('service_role', 'posta_allegati', 'insert') then
    raise exception 'Il servizio non puo'' registrare gli allegati.';
  end if;

  -- Ciò che non serve, non c'è. Se un domani qualcuno concedesse tutto
  -- «per comodità», questa migrazione rieseguita se ne accorge.
  foreach t in array array['orders', 'documents', 'reservations', 'tasks',
                           'supplier_invoices', 'employees', 'cash_movements']
  loop
    if has_table_privilege('service_role', t, 'select')
       or has_table_privilege('service_role', t, 'insert') then
      n := n + 1;
      raise warning 'Il ruolo di servizio ha accesso a %, e non dovrebbe.', t;
    end if;
  end loop;
  if n > 0 then
    raise exception 'Il ruolo di servizio ha accesso a % tabelle oltre alla posta.', n;
  end if;

  raise notice 'Permessi della posta: il servizio scrive le due tabelle della posta, e nient''altro.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000003', 'permessi_servizio_posta')
on conflict (version) do nothing;

select c.relname as tabella,
       has_table_privilege('service_role', c.oid, 'insert') as il_servizio_puo_scrivere
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
 where ns.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('posta_ricevuta', 'posta_allegati', 'documents', 'orders')
 order by 1;
