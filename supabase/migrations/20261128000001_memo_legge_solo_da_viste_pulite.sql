-- 28/11/2026 — MEMO libero, passo L1: un utente di SOLA LETTURA e le prime viste «pulite».
--
-- Perché. Il piano «MEMO libero» (strada B, approvata da Alessio il 23/11) vuole che MEMO risponda a domande nuove senza che
-- per ognuna serva una lettura fatta a mano. La sicurezza non sta nelle istruzioni al modello: sta nel database. Questa
-- migrazione prepara le due cose su cui poggerà il passo L2 (`memo_interroga`):
--   1. un ruolo `memo_lettore`, SENZA accesso da fuori (nologin), che può solo LEGGERE le viste dello schema
--      `memo_lettura` e nient'altro: nessuna tabella, nessuna funzione, nessuna scrittura, nessuno schema `public`;
--   2. le viste `memo_v_*`, che applicano le STESSE regole delle pagine (stesse funzioni, stessi filtri) e portano
--      solo le colonne scelte.
-- Non cambia niente di ciò che l'app fa oggi: le 11 letture fisse restano, nessuna tabella e nessuna funzione esistente
-- viene toccata. Nessuno (neanche l'app) legge ancora queste viste: arriveranno con L2.
--
-- Che cosa NON c'è dentro (decisioni di Alessio, 23/11): segreti e chiavi, schema degli accessi (auth, vault), storico
-- delle chat di MEMO. Per la posta ci sono solo le intestazioni (mittente, oggetto, data, stato, cosa ha proposto la
-- lettura): il TESTO delle mail non c'è, e si aggiunge solo con un sì esplicito. Nessun dato di clienti, personale o
-- fornitori è stato tolto per prudenza: Alessio ha deciso che MEMO può vederli.
--
-- Come funzionano i permessi (da leggere per chi rivede):
--   - le viste sono del proprietario (`postgres`), quindi leggono le tabelle SENZA passare dalle RLS: è voluto, e il
--     controllo «solo il titolare» lo fa la porta (`memo_interroga`, L2) PRIMA di passare al ruolo `memo_lettore`;
--     nessun altro ruolo (anon, authenticated, service_role) ha accesso allo schema `memo_lettura`;
--   - `memo_lettore` non ha permessi su nessuna tabella di `public` e può eseguire, lì, solo funzioni che non scrivono
--     (`fai_*`, `colloca_*`, `segna_*` ... no: la verifica di questa migrazione lo controlla funzione per funzione);
--   - i limiti di tempo (3 secondi) e di righe (200) NON si possono mettere sul ruolo (valgono solo al login, e questo
--     ruolo non fa login): li mette `memo_interroga` con `set local`.
--
-- Regole delle pagine riprese una per una (non ricopiate «a occhio»):
--   - incasso di un conto = `coalesce(sconto/omaggio.collected_amount, totale_conto(...).totale)`, serata = `serata_di_servizio`,
--     solo conti chiusi/omaggiati e con incasso > 0 (`quadratura_fiscale_per_giorno`);
--   - prenotazione «che conta» = stato confermata o richiesta_in_attesa (`memo_leggi_prenotazioni`);
--   - da pagare di una fattura = `da_pagare(fattura)` solo se `da_pagare` (`memo_leggi_fatture_fornitori`);
--   - prestito: restituito, residuo, estinto (`prestiti_aperti`); «Ho pagato io» aperta = non pareggiata (`saldo_anticipazioni`).

-- ---------------------------------------------------------------------
-- 1. Il ruolo: nasce vuoto, senza login, senza poteri.
-- ---------------------------------------------------------------------
do $ruolo$
begin
  if not exists (select 1 from pg_roles where rolname = 'memo_lettore') then
    create role memo_lettore nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $ruolo$;
-- Se il ruolo esistesse già, si riallineano gli attributi che possiamo cambiare (superuser, bypassrls e replica no: ci pensa la verifica (1), che si ferma).
alter role memo_lettore nologin noinherit nocreatedb nocreaterole connection limit 0;

-- Chi crea una funzione di «porta» (L2) deve poter passare a questo ruolo con `set local role`. Per `SET ROLE` conta l'utente
-- di SESSIONE, non quello della funzione: dall'app la sessione è `authenticator`, dall'editor SQL è `postgres`. Passare a
-- questo ruolo vuol dire avere MENO poteri, quindi dargli il permesso di passare non aggiunge niente a nessuno.
grant memo_lettore to postgres with set true, inherit false;
do $sessione$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant memo_lettore to authenticator with set true, inherit false;
  end if;
end $sessione$;

-- ---------------------------------------------------------------------
-- 2. Lo schema delle viste: chiuso a tutti tranne al ruolo di lettura.
-- ---------------------------------------------------------------------
create schema if not exists memo_lettura;
revoke all on schema memo_lettura from public, anon, authenticated, service_role;
grant usage on schema memo_lettura to memo_lettore;
comment on schema memo_lettura is 'Viste di sola lettura per MEMO (passo L1 del piano MEMO libero). Solo il ruolo memo_lettore le legge; le porta una funzione che controlla prima is_titolare().';

-- ---------------------------------------------------------------------
-- 2b. Quattro funzioni «di passaggio» (scoperte provando davvero col ruolo, 28/11).
--
-- Le viste girano come proprietario per le TABELLE, ma le FUNZIONI che usano girano come chi legge la vista: lo dice la
-- documentazione di PostgreSQL, e la prima prova l'ha confermato («permission denied for function totale_conto»).
-- `memo_lettore` non deve poter eseguire niente di `public` (né leggere le sue tabelle: `serata_di_servizio` e `da_pagare`
-- ne leggono). La cura non è dargli le funzioni di `public`, ma quattro funzioni SUE, piccole, che girano come
-- proprietario, con il percorso fisso, di sola lettura (`stable`), e chiamano quelle vere: le STESSE regole delle pagine.
-- Nessuna lascia scegliere al chiamante una tabella o un nome: prendono un id, una data o niente.
-- ---------------------------------------------------------------------
create or replace function memo_lettura.f_serata(p_istante timestamptz)
returns date language sql stable security definer set search_path = pg_catalog, pg_temp as
$$ select public.serata_di_servizio(p_istante) $$;

create or replace function memo_lettura.f_oggi()
returns date language sql stable security definer set search_path = pg_catalog, pg_temp as
$$ select public.oggi_a_roma() $$;

create or replace function memo_lettura.f_da_pagare(p_fattura uuid)
returns numeric language sql stable security definer set search_path = pg_catalog, pg_temp as
$$ select public.da_pagare(i) from public.supplier_invoices i where i.id = p_fattura $$;

create or replace function memo_lettura.f_totale_conto(p_conto uuid)
returns table(righe numeric, coperti integer, prezzo_coperto numeric, totale numeric,
              righe_mai_inviate integer, valore_mai_inviate numeric, supplementi numeric)
language sql stable security definer set search_path = pg_catalog, pg_temp as
$$ select t.righe, t.coperti, t.prezzo_coperto, t.totale, t.righe_mai_inviate, t.valore_mai_inviate, t.supplementi
     from public.totale_conto(p_conto) t $$;

revoke all on function memo_lettura.f_serata(timestamptz), memo_lettura.f_oggi(), memo_lettura.f_da_pagare(uuid),
                       memo_lettura.f_totale_conto(uuid) from public, anon, authenticated, service_role;
grant execute on function memo_lettura.f_serata(timestamptz), memo_lettura.f_oggi(), memo_lettura.f_da_pagare(uuid),
                          memo_lettura.f_totale_conto(uuid) to memo_lettore;

-- ---------------------------------------------------------------------
-- 3. Le viste. Tutto è schema-qualificato: queste viste non dipendono dal search_path di chi le legge.
-- ---------------------------------------------------------------------

-- 3.1 Conti di sala (uno per conto): quanto, quando, come è stato pagato, che documento fiscale ha.
create or replace view memo_lettura.memo_v_conti_sala with (security_invoker = false) as
select o.id                                   as riga_id,
       en.name                                as societa,
       memo_lettura.f_serata(o.closed_at) as serata,
       o.opened_at                            as aperto_il,
       o.closed_at                            as chiuso_il,
       o.status::text                         as stato,
       o.table_label                          as tavolo,
       o.coperti                              as coperti,
       o.linea                                as linea,
       tc.righe                               as totale_righe,
       tc.totale                              as totale_conto,
       case when o.status in ('chiuso', 'omaggiato')
            then coalesce(d.collected_amount, tc.totale) end as incasso,
       d.type::text                           as tipo_sconto_omaggio,
       d.full_amount                          as importo_pieno,
       d.causale_note                         as motivo_sconto_omaggio,
       o.payment_method::text                 as metodo_pagamento,
       pg.mezzi                               as mezzi_pagamento,
       pg.pagato                              as pagato,
       o.documento_fiscale                    as documento_fiscale,
       o.documento_numero                     as documento_numero,
       o.documento_emesso_il                  as documento_emesso_il,
       cu.name                                as cliente,
       (o.reservation_id is not null)         as da_prenotazione,
       o.cancel_reason                        as motivo_annullo,
       o.note                                 as note
  from public.orders o
  join public.entities en on en.id = o.entity_id
  left join public.discounts_gifts d on d.id = o.discount_gift_id
  left join public.customers cu on cu.id = o.customer_id
 cross join lateral memo_lettura.f_totale_conto(o.id) tc
  left join lateral (
    select string_agg(p.mezzo || ' ' || p.importo::text, ' + ' order by p.created_at) as mezzi,
           sum(p.importo) as pagato
      from public.order_payments p
     where p.order_id = o.id
  ) pg on true;
comment on view memo_lettura.memo_v_conti_sala is
  'Conti di sala, uno per conto. incasso = quanto è entrato davvero (sconto/omaggio compreso), solo per i conti chiusi o omaggiati. serata = la serata di servizio (dopo mezzanotte conta ancora la sera prima).';

-- 3.2 Incassi giornalieri: stessa regola della quadratura fiscale (incassato, scontrinato, da fiscalizzare).
create or replace view memo_lettura.memo_v_incassi_giornalieri with (security_invoker = false) as
select c.societa,
       c.serata,
       count(*)::integer                              as conti,
       sum(c.incasso)                                 as incassato,
       coalesce(sum(c.incasso) filter (
         where c.documento_fiscale in ('scontrino', 'fattura')), 0)              as scontrinato,
       coalesce(sum(c.incasso) filter (
         where c.documento_fiscale is null or c.documento_fiscale = 'fattura_da_emettere'), 0) as da_fiscalizzare,
       coalesce(count(*) filter (
         where c.documento_fiscale is null or c.documento_fiscale = 'fattura_da_emettere'), 0)::integer as conti_da_fiscalizzare,
       coalesce(sum(c.coperti), 0)::integer           as coperti
  from memo_lettura.memo_v_conti_sala c
 where c.stato in ('chiuso', 'omaggiato')
   and c.serata is not null
   and c.incasso > 0
 group by c.societa, c.serata;
comment on view memo_lettura.memo_v_incassi_giornalieri is
  'Incassi per serata e società: incassato, scontrinato, da fiscalizzare. Stessa regola della quadratura fiscale della pagina Cassa.';

-- 3.3 Prenotazioni.
create or replace view memo_lettura.memo_v_prenotazioni with (security_invoker = false) as
select r.id                                   as riga_id,
       r.reservation_date                     as data_prenotazione,
       r.reservation_time                     as ora_prenotazione,
       r.party_size                           as persone,
       r.status::text                         as stato,
       (r.status in ('confermata', 'richiesta_in_attesa')) as conta,
       r.type::text                           as tipo,
       r.source::text                         as origine,
       r.event_type                           as tipo_evento,
       r.customer_name                        as cliente,
       r.customer_phone                       as telefono,
       r.customer_email                       as email,
       r.notes                                as note,
       tv.tavoli                              as tavoli,
       dep.amount                             as caparra,
       r.created_at                           as creata_il
  from public.reservations r
  left join lateral (
    select string_agg(pt.etichetta_al_momento, ', ' order by pt.etichetta_al_momento) as tavoli
      from public.prenotazione_tavoli pt
     where pt.reservation_id = r.id
  ) tv on true
  left join public.reservation_deposits dep on dep.reservation_id = r.id;
comment on view memo_lettura.memo_v_prenotazioni is
  'Prenotazioni. conta = vero per quelle confermate o in attesa (le sole che occupano posti, come nella pagina). caparra = importo della caparra versata, se c''è.';

-- 3.4 Personale (anagrafica + giorni di assenza dell''anno in corso).
create or replace view memo_lettura.memo_v_personale with (security_invoker = false) as
select e.id                                   as riga_id,
       en.name                                as societa,
       e.first_name                           as nome,
       e.last_name                            as cognome,
       e.role                                 as ruolo,
       e.contract_type::text                  as contratto,
       e.status::text                         as stato,
       e.hire_date                            as assunto_il,
       e.end_date                             as fine_rapporto,
       e.phone                                as telefono,
       e.email                                as email,
       e.prior_year_income                    as reddito_anno_precedente,
       e.note                                 as note,
       coalesce(a.ferie, 0)                   as giorni_ferie_anno,
       coalesce(a.malattia, 0)                as giorni_malattia_anno,
       coalesce(a.permessi, 0)                as giorni_permesso_anno
  from public.employees e
  join public.entities en on en.id = e.entity_id
  left join lateral (
    select sum(l.days) filter (where l.leave_type::text = 'ferie')    as ferie,
           sum(l.days) filter (where l.leave_type::text = 'malattia') as malattia,
           sum(l.days) filter (where l.leave_type::text = 'permesso') as permessi
      from public.employee_leaves l
     where l.employee_id = e.id
       and extract(year from l.start_date) = extract(year from memo_lettura.f_oggi())
  ) a on true;
comment on view memo_lettura.memo_v_personale is
  'Dipendenti: anagrafica e giorni di ferie, malattia e permesso dell''anno in corso. Il gestionale non registra i turni di lavoro dei dipendenti: non ci sono.';

create or replace view memo_lettura.memo_v_assenze_personale with (security_invoker = false) as
select l.id                                   as riga_id,
       e.first_name                           as nome,
       e.last_name                            as cognome,
       l.leave_type::text                     as tipo,
       l.start_date                           as dal,
       l.end_date                             as al,
       l.days                                 as giorni,
       l.note                                 as note
  from public.employee_leaves l
  join public.employees e on e.id = l.employee_id;
comment on view memo_lettura.memo_v_assenze_personale is
  'Ferie, permessi e malattie dei dipendenti, una riga per periodo.';

-- 3.5 «Ho pagato io» (anticipazioni del socio) e prestiti da privati.
create or replace view memo_lettura.memo_v_ho_pagato_io with (security_invoker = false) as
select a.id                                   as riga_id,
       en.name                                as societa,
       a.pagata_il                            as pagata_il,
       a.importo                              as importo,
       t.etichetta                            as tag,
       a.fondi                                as fondi,
       s.name                                 as fornitore,
       i.invoice_number                       as fattura,
       a.documento_riferimento                as documento,
       a.nota                                 as nota,
       a.e_investimento                       as e_investimento,
       (a.pareggiata_il is null)              as aperta,
       a.pareggiata_il                        as pareggiata_il
  from public.anticipazioni_socio a
  join public.entities en on en.id = a.entity_id
  left join public.tag_anticipazioni t on t.id = a.tag_id
  left join public.supplier_invoices i on i.id = a.supplier_invoice_id
  left join public.suppliers s on s.id = i.supplier_id;
comment on view memo_lettura.memo_v_ho_pagato_io is
  'Spese pagate di tasca propria dal titolare. aperta = vero se la società non gli ha ancora rimborsato quella nota (la somma delle aperte è «quanto ti deve la società»).';

create or replace view memo_lettura.memo_v_prestiti with (security_invoker = false) as
select p.id                                   as riga_id,
       en.name                                as societa,
       p.da_chi                               as da_chi,
       p.importo                              as importo,
       coalesce(r.tot, 0)::numeric            as restituito,
       (p.importo - coalesce(r.tot, 0))::numeric as residuo,
       (coalesce(r.tot, 0) >= p.importo)      as estinto,
       p.mezzo                                as mezzo,
       p.ricevuto_il                          as ricevuto_il,
       p.nota                                 as nota
  from public.prestiti_privati p
  join public.entities en on en.id = p.entity_id
  left join lateral (
    select sum(x.importo) as tot from public.restituzioni_prestito x where x.prestito_id = p.id
  ) r on true;
comment on view memo_lettura.memo_v_prestiti is
  'Prestiti ricevuti da privati: importo, restituito, residuo, estinto (stessa regola della pagina dei prestiti).';

-- 3.6 Fornitori e loro fatture.
create or replace view memo_lettura.memo_v_fornitori with (security_invoker = false) as
select s.id                                   as riga_id,
       en.name                                as societa,
       s.name                                 as fornitore,
       s.category::text                       as categoria,
       s.active                               as attivo,
       s.is_occasional                        as occasionale,
       s.tax_code                             as codice_fiscale_o_piva,
       s.contact_person                       as referente,
       s.contact_phone                        as telefono,
       s.contact_email                        as email,
       s.payment_terms                        as condizioni_pagamento,
       s.delivery_days                        as giorni_consegna,
       s.canale_ordine                        as canale_ordine,
       s.regime_esonero                       as regime_esonero,
       s.notes                                as note,
       coalesce(f.n, 0)::integer              as fatture,
       coalesce(f.n_da_pagare, 0)::integer    as fatture_da_pagare,
       coalesce(f.da_pagare_tot, 0)           as da_pagare,
       f.prossima_scadenza                    as prossima_scadenza,
       coalesce(f.fatturato, 0)               as fatturato_totale
  from public.suppliers s
  join public.entities en on en.id = s.entity_id
  left join lateral (
    select count(*) as n,
           count(*) filter (where i.status = 'da_pagare') as n_da_pagare,
           coalesce(sum(memo_lettura.f_da_pagare(i.id)) filter (where i.status = 'da_pagare'), 0) as da_pagare_tot,
           min(i.due_date) filter (where i.status = 'da_pagare') as prossima_scadenza,
           sum(i.amount) as fatturato
      from public.supplier_invoices i
     where i.supplier_id = s.id
  ) f on true;
comment on view memo_lettura.memo_v_fornitori is
  'Fornitori con il riepilogo delle loro fatture: quante, quante da pagare, quanto resta da pagare e la prossima scadenza.';

create or replace view memo_lettura.memo_v_fatture_fornitori with (security_invoker = false) as
select i.id                                   as riga_id,
       en.name                                as societa,
       s.name                                 as fornitore,
       i.invoice_number                       as numero,
       i.invoice_date                         as data_fattura,
       i.due_date                             as scadenza,
       i.amount                               as totale_fattura,
       i.imponibile                           as imponibile,
       i.imposta                              as imposta,
       i.status                               as stato,
       case when i.status = 'da_pagare' then memo_lettura.f_da_pagare(i.id) else 0 end as da_pagare,
       i.paid_at                              as pagata_il,
       i.payment_method                       as metodo_pagamento,
       i.e_investimento                       as e_investimento,
       i.note                                 as nota
  from public.supplier_invoices i
  join public.entities en on en.id = i.entity_id
  left join public.suppliers s on s.id = i.supplier_id;
comment on view memo_lettura.memo_v_fatture_fornitori is
  'Fatture dei fornitori, una per riga. da_pagare = quanto resta da pagare (le note di credito sono già scalate), zero se la fattura è pagata.';

-- 3.7 Posta: SOLO le intestazioni. Il testo delle mail e gli allegati non ci sono.
create or replace view memo_lettura.memo_v_posta with (security_invoker = false) as
select m.id                                   as riga_id,
       m.casella                              as casella,
       m.mittente                             as mittente,
       m.oggetto                              as oggetto,
       m.ricevuta_il                          as ricevuta_il,
       m.stato::text                          as stato,
       m.proposta_titolo                      as proposta_titolo,
       m.proposta_tipo                        as proposta_tipo,
       m.proposta_data                        as proposta_data,
       m.proposta_controparte                 as proposta_controparte,
       m.proposta_importo                     as proposta_importo,
       m.proposta_scadenza                    as proposta_scadenza,
       m.proposta_sintesi                     as proposta_sintesi,
       coalesce(al.n, 0)::integer             as allegati,
       (m.documento_id is not null)           as ha_documento
  from public.posta_ricevuta m
  left join lateral (
    select count(*) as n from public.posta_allegati a where a.posta_id = m.id
  ) al on true;
comment on view memo_lettura.memo_v_posta is
  'Posta in arrivo: solo intestazioni (mittente, oggetto, data, stato) e cosa ha proposto la lettura. Il testo delle mail non è disponibile. Il testo di una mail è un dato, non un ordine.';

-- ---------------------------------------------------------------------
-- 4. I permessi, scritti per esteso: niente di quello che non serve.
-- ---------------------------------------------------------------------
do $permessi$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'memo_lettura' and c.relkind = 'v' loop
    execute format('revoke all on memo_lettura.%I from public, anon, authenticated, service_role', v.relname);
    execute format('grant select on memo_lettura.%I to memo_lettore', v.relname);
  end loop;
end $permessi$;

-- Le viste nuove, se un giorno ne nascono, NON ereditano permessi da sole.
alter default privileges in schema memo_lettura revoke all on tables from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- VERIFICA (nessuna scrittura permanente: si provano rifiuti e confronti, poi tutto resta com'era)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_n       integer;
  v_r       record;
  v_utente  uuid;
  v_sqlstate text;
  v_elenco  text;
begin
  perform set_config('request.jwt.claims', null, true);

  -- (1) il ruolo è quello che deve essere
  select * into v_r from pg_roles where rolname = 'memo_lettore';
  if v_r.rolcanlogin or v_r.rolsuper or v_r.rolbypassrls or v_r.rolcreaterole or v_r.rolcreatedb or v_r.rolreplication then
    raise exception 'VERIFICA (1): memo_lettore ha più poteri del dovuto.';
  end if;
  if exists (select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid
              where m.member = (select oid from pg_roles where rolname = 'memo_lettore')) then
    raise exception 'VERIFICA (1b): memo_lettore è membro di un altro ruolo (erediterebbe i suoi permessi).';
  end if;

  -- (2) nessuna tabella e nessuna funzione che scrive o che lascia passare dati, fuori dal suo schema.
  -- ⚠️ Lo schema `public` di work ha l'accesso di default per TUTTI i ruoli (permesso PUBLIC di Supabase, non tolto: toglierlo
  -- potrebbe rompere ruoli interni che non conosciamo); quello di Prova ricostruita no. Quindi NON si pretende «niente usage
  -- su public»: si pretende che, anche entrandoci, non ci sia niente da leggere o da eseguire (controlli 2c e 2d).
  if has_schema_privilege('memo_lettore', 'auth', 'usage') or has_schema_privilege('memo_lettore', 'vault', 'usage') then
    raise exception 'VERIFICA (2b): memo_lettore vede auth o vault.';
  end if;
  -- Conta solo ciò che è DAVVERO raggiungibile: il permesso sulla tabella e l'accesso allo schema che la contiene.
  -- Resta una sola eccezione, e non dipende da noi: lo schema `net` (l'estensione pg_net, gestita da Supabase) lascia
  -- `usage` e la lettura a TUTTI i ruoli (permesso PUBLIC, che nessun ruolo può togliersi di dosso e che noi, non essendo
  -- i proprietari, non possiamo togliere). Dentro ci sono le risposte alle chiamate HTTP del database. Non è raggiungibile
  -- da nessun accesso (il ruolo non fa login): lo sarebbe solo se la porta (L2) componesse una query con nomi non presi
  -- dal catalogo, e L2 accetta solo nomi di viste e colonne del catalogo. Va detto al revisore, e non si finge che non ci sia.
  select count(*), string_agg(n.nspname || '.' || c.relname, ', ') into v_n, v_elenco
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname not in ('pg_catalog', 'information_schema', 'memo_lettura')
     and not (n.nspname = 'net' and c.relname in ('_http_response', 'http_request_queue'))
     and has_schema_privilege('memo_lettore', n.oid, 'usage')
     and c.relkind in ('r', 'v', 'm', 'p', 'f')
     and (has_table_privilege('memo_lettore', c.oid, 'select')
          or has_table_privilege('memo_lettore', c.oid, 'insert')
          or has_table_privilege('memo_lettore', c.oid, 'update')
          or has_table_privilege('memo_lettore', c.oid, 'delete')
          or has_table_privilege('memo_lettore', c.oid, 'truncate'));
  if v_n <> 0 then
    raise exception 'VERIFICA (2c): memo_lettore ha permessi su % tabelle/viste fuori dal suo schema: %.', v_n, v_elenco;
  end if;
  -- Lo stesso per le FUNZIONI: dove il ruolo può entrare (schema con usage), può eseguire SOLO funzioni che non possono
  -- scrivere né far uscire dati: funzioni «trigger» (non si chiamano a mano) oppure `stable`/`immutable` e NON `security definer`
  -- (una funzione di sola lettura che gira coi permessi di chi la chiama non vede nulla che il ruolo non veda già).
  -- Su work sono otto, tutte così (6 trigger, `is_titolare`, `normalize_phone`, `task_origin_visible_to_staff`). Fuori dai
  -- cataloghi di sistema e dallo schema `net` (stessa eccezione di sopra: i permessi PUBLIC di pg_net).
  select count(*), string_agg(distinct n.nspname || '.' || p.proname, ', ') into v_n, v_elenco
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema', 'memo_lettura', 'net')
     and has_schema_privilege('memo_lettore', n.oid, 'usage')
     and has_function_privilege('memo_lettore', p.oid, 'execute')
     and not (p.prorettype = 'trigger'::regtype or (p.provolatile in ('s', 'i') and not p.prosecdef));
  if v_n <> 0 then
    raise exception 'VERIFICA (2d): memo_lettore può eseguire % funzioni che potrebbero scrivere o far uscire dati: %.', v_n, v_elenco;
  end if;
  -- (2e) le sole funzioni SUE sono le quattro «di passaggio»: tutte di sola lettura, col percorso fisso, che girano
  -- come proprietario; nessuna eseguibile da altri ruoli.
  select count(*), string_agg(p.proname, ', ') into v_n, v_elenco
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'memo_lettura'
     and (p.provolatile <> 's' or not p.prosecdef or p.proconfig is null or not has_function_privilege('memo_lettore', p.oid, 'execute')
          or has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
          or has_function_privilege('service_role', p.oid, 'execute'));
  if v_n <> 0 then
    raise exception 'VERIFICA (2e): funzioni di passaggio sbagliate (non stable, non definer, senza percorso fisso, o aperte ad altri): %.', v_elenco;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'memo_lettura') <> 4 then
    raise exception 'VERIFICA (2e bis): le funzioni di passaggio dovevano essere quattro.';
  end if;
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'net' and has_function_privilege('memo_lettore', p.oid, 'execute');
  raise notice 'Nota per il revisore: nello schema net (pg_net, di Supabase) il ruolo vede % funzioni per il permesso PUBLIC; la porta L2 non deve mai far arrivare un nome «net» alla query.', v_n;

  -- (3) sulle sue viste può solo leggere
  select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'memo_lettura' and c.relkind = 'v'
     and (not has_table_privilege('memo_lettore', c.oid, 'select')
          or has_table_privilege('memo_lettore', c.oid, 'insert')
          or has_table_privilege('memo_lettore', c.oid, 'update')
          or has_table_privilege('memo_lettore', c.oid, 'delete')
          or has_table_privilege('memo_lettore', c.oid, 'truncate'));
  if v_n <> 0 then
    raise exception 'VERIFICA (3): % viste con permessi sbagliati (si deve poter solo leggere).', v_n;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'memo_lettura'
                and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')
                     or has_table_privilege('service_role', c.oid, 'select'))) then
    raise exception 'VERIFICA (3b): una vista è leggibile da anon, authenticated o service_role.';
  end if;

  -- (4) le colonne che non devono esserci non ci sono (testo delle mail, segreti, chiavi, accessi)
  if exists (select 1 from information_schema.columns
              where table_schema = 'memo_lettura'
                and (column_name in ('testo', 'password', 'token', 'segreto', 'chiave', 'iban', 'storage_path')
                     or column_name ilike '%secret%' or column_name ilike '%password%' or column_name ilike '%api_key%')) then
    raise exception 'VERIFICA (4): una vista porta una colonna vietata (testo mail, segreti, chiavi o accessi).';
  end if;

  -- (5) provato DAVVERO, passando al ruolo: lettura sì, tutto il resto no.
  -- Le due viste dei conti chiamano `totale_conto`, che pretende un utente collegato (non guarda chi: guarda che ci sia):
  -- la porta L2 lascerà i claims del titolare mentre passa al ruolo; qui se ne mette uno qualunque.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    set local role memo_lettore;
    perform 1 from memo_lettura.memo_v_conti_sala limit 1;
    perform 1 from memo_lettura.memo_v_incassi_giornalieri limit 1;
    perform 1 from memo_lettura.memo_v_prenotazioni limit 1;
    perform 1 from memo_lettura.memo_v_posta limit 1;
    perform 1 from memo_lettura.memo_v_fornitori limit 1;
    perform 1 from memo_lettura.memo_v_ho_pagato_io limit 1;
    perform 1 from memo_lettura.memo_v_prestiti limit 1;
    perform 1 from memo_lettura.memo_v_personale limit 1;
    perform 1 from memo_lettura.memo_v_assenze_personale limit 1;
    perform 1 from memo_lettura.memo_v_fatture_fornitori limit 1;
    reset role;
  exception when others then
    reset role;
    raise exception 'VERIFICA (5a): la lettura delle viste dal ruolo di sola lettura non riesce: %', sqlerrm;
  end;

  perform set_config('request.jwt.claims', null, true);

  -- scritture, tabelle vere, funzioni, schemi altrui, creazioni: tutto deve dire «permesso negato» (42501).
  -- Le scritture sulle VISTE possono dire anche «la vista non si può modificare» (secondo muro, davanti al primo);
  -- tutto il resto accetta solo 42501.
  declare
    v_prove text[] := array[
      'delete from public.orders',
      'update public.orders set note = ''x''',
      'insert into public.entities (name) values (''x'')',
      'select pg_read_file(''/etc/hostname'')',
      'select lo_import(''/etc/hostname'')',
      'select pg_ls_dir(''.'')',
      'update memo_lettura.memo_v_prenotazioni set stato = ''x''',
      'insert into memo_lettura.memo_v_prestiti (da_chi) values (''x'')',
      'delete from memo_lettura.memo_v_fornitori',
      'truncate memo_lettura.memo_v_posta',
      'select count(*) from public.employees',
      'select count(*) from public.memo_messaggi',
      'select count(*) from auth.users',
      'select count(*) from vault.secrets',
      'select public.is_titolare()',
      'create table public.zz_memo_lettore (a int)',
      'create table memo_lettura.zz_memo_lettore (a int)',
      'create view memo_lettura.zz_memo_vista as select 1'
    ];
    v_prova text;
    v_riuscita boolean;
    v_su_vista boolean;
  begin
    foreach v_prova in array v_prove loop
      v_riuscita := false;
      v_sqlstate := null;
      v_su_vista := v_prova ~ '^(update|insert into|delete from|truncate) memo_lettura\.';
      begin
        set local role memo_lettore;
        execute v_prova;
        v_riuscita := true;
        reset role;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate;
        reset role;
      end;
      if v_riuscita then
        raise exception 'VERIFICA (5b): il ruolo di sola lettura è riuscito a fare: %', v_prova;
      end if;
      -- 42501 = permesso negato; per le viste anche 55000 («non si può modificare») e 42809 («non è una tabella»).
      if v_sqlstate is distinct from '42501' and not (v_su_vista and v_sqlstate in ('55000', '42809')) then
        raise exception 'VERIFICA (5b): « % » doveva essere rifiutata e ha detto %.', v_prova, v_sqlstate;
      end if;
    end loop;
  end;

  -- (5c) le società si riconoscono per nome nelle viste: due società con lo stesso nome sommerebbero i loro conti
  if exists (select 1 from public.entities group by name having count(*) > 1) then
    raise exception 'VERIFICA (5c): due società hanno lo stesso nome: le viste le confonderebbero.';
  end if;

  -- (6) i totali delle viste sono quelli delle pagine (se nel database ci sono dei dati e un titolare per leggerli)
  select ur.user_id into v_utente from public.user_roles ur where ur.role = 'titolare' limit 1;
  if v_utente is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_utente, 'role', 'authenticated')::text, true);

    -- (6a) incassi per serata = quadratura fiscale della pagina, società per società
    select count(*) into v_n from (
      select en.name as societa, q.serata, q.quanti, q.incassato, q.scontrinato, q.da_fiscalizzare, q.quanti_da_fare
        from public.entities en
       cross join lateral public.quadratura_fiscale_per_giorno(en.id, date '2000-01-01', date '2100-01-01') q
      except
      select v.societa, v.serata, v.conti, v.incassato, v.scontrinato, v.da_fiscalizzare, v.conti_da_fiscalizzare
        from memo_lettura.memo_v_incassi_giornalieri v
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6a): % serate dove la vista degli incassi non coincide con la quadratura fiscale della pagina.', v_n;
    end if;
    select count(*) into v_n from (
      select v.societa, v.serata, v.conti, v.incassato, v.scontrinato, v.da_fiscalizzare, v.conti_da_fiscalizzare
        from memo_lettura.memo_v_incassi_giornalieri v
      except
      select en.name, q.serata, q.quanti, q.incassato, q.scontrinato, q.da_fiscalizzare, q.quanti_da_fare
        from public.entities en
       cross join lateral public.quadratura_fiscale_per_giorno(en.id, date '2000-01-01', date '2100-01-01') q
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6a bis): % serate presenti nella vista degli incassi e assenti dalla quadratura della pagina.', v_n;
    end if;

    -- (6b) prenotazioni che contano e posti = lettura di MEMO «come la pagina»
    select count(*) into v_n from (
      select count(*) filter (where vale)::integer as n, coalesce(sum(coperti) filter (where vale), 0)::numeric as posti
        from (select (r.status in ('confermata', 'richiesta_in_attesa')) as vale, coalesce(r.party_size, 0) as coperti
                from public.reservations r) z
      except
      select count(*) filter (where conta)::integer, coalesce(sum(persone) filter (where conta), 0)::numeric
        from memo_lettura.memo_v_prenotazioni
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6b): le prenotazioni che contano nella vista non sono quelle della tabella.';
    end if;
    if (select count(*) from memo_lettura.memo_v_prenotazioni) <> (select count(*) from public.reservations) then
      raise exception 'VERIFICA (6b bis): la vista delle prenotazioni ha righe in più o in meno (una prenotazione ha più di una caparra?).';
    end if;

    -- (6c) da pagare ai fornitori = totale della lettura fissa
    select count(*) into v_n from (
      select en.id, coalesce(sum(public.da_pagare(i)) filter (where i.status = 'da_pagare'), 0)::numeric as t
        from public.entities en left join public.supplier_invoices i on i.entity_id = en.id group by en.id
      except
      select en.id, coalesce(sum(f.da_pagare), 0)::numeric
        from public.entities en left join memo_lettura.memo_v_fatture_fornitori f on f.societa = en.name group by en.id
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6c): il da pagare delle fatture nella vista non coincide con quello della tabella.';
    end if;
    if (select coalesce(sum(da_pagare), 0) from memo_lettura.memo_v_fornitori)
       <> (select coalesce(sum(da_pagare), 0) from memo_lettura.memo_v_fatture_fornitori) then
      raise exception 'VERIFICA (6c bis): il da pagare per fornitore non coincide con quello per fattura.';
    end if;

    -- (6d) «Ho pagato io»: le aperte sono quelle di saldo_anticipazioni; prestiti = prestiti_aperti
    select count(*) into v_n from (
      select en.name as societa, s.ti_deve, s.note_aperte
        from public.entities en cross join lateral public.saldo_anticipazioni(en.id) s
      except
      select en.name, coalesce(sum(h.importo) filter (where h.aperta), 0), (count(*) filter (where h.aperta))::integer
        from public.entities en left join memo_lettura.memo_v_ho_pagato_io h on h.societa = en.name group by en.name
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6d): le note «Ho pagato io» aperte nella vista non coincidono con il saldo della pagina.';
    end if;
    select count(*) into v_n from (
      select p.id, p.importo, p.restituito, p.residuo, p.estinto
        from public.entities en cross join lateral public.prestiti_aperti(en.id) p
      except
      select riga_id, importo, restituito, residuo, estinto from memo_lettura.memo_v_prestiti
    ) x;
    if v_n <> 0 then
      raise exception 'VERIFICA (6e): % prestiti dove la vista non coincide con la pagina.', v_n;
    end if;

    perform set_config('request.jwt.claims', null, true);
  else
    raise notice 'Verifica (6): nessun titolare in questo database, i confronti coi totali delle pagine sono stati saltati.';
  end if;

  raise notice 'Fatto: ruolo memo_lettore di sola lettura (nessun accesso fuori dal suo schema), 10 viste memo_v_*; totali coincidenti con le pagine dove ci sono dati.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261128000001', 'memo_legge_solo_da_viste_pulite')
on conflict (version) do nothing;
