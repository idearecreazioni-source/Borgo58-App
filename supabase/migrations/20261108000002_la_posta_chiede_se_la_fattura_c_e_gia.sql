-- =====================================================================
-- LA POSTA CHIEDE SE LA FATTURA C'È GIÀ, SENZA LEGGERE LE FATTURE — 08/11/2026
-- =====================================================================
--
-- Trovato dal vivo alla prima PEC vera dopo il rilascio (08/11, fattura
-- 330/F): `posta-leggi` si fermava con «non riesco a controllare se la
-- fattura … è già registrata (403)». La mail restava «da leggere», veniva
-- ripresa ogni 15 minuti e partiva l'avviso «posta letta a metà».
--
-- La causa: per sapere se la fattura era già registrata, `posta-leggi`
-- leggeva `supplier_invoices` con la chiave di servizio. Ma quella chiave
-- NON PUÒ leggere le tabelle dei soldi, e non per dimenticanza: lo vieta
-- apposta 20260812000003 («accesso concesso, ma solo alle tabelle della
-- posta»), con una verifica che controlla proprio `supplier_invoices`.
-- Le prove non se ne sono accorte perché nessuna parla al database come
-- la chiave di servizio.
--
-- ⚠️ QUINDI NIENTE `grant select on supplier_invoices to service_role`.
--    Aprirebbe al servizio tutte le fatture, con importi e fornitori, per
--    rispondere a una domanda sola. Al suo posto una funzione che risponde
--    SOLO a quella domanda: dati i nomi del file SdI, dice numero e data
--    della fattura già registrata, oppure niente. La può chiamare solo la
--    chiave di servizio.
--
-- Il controllo di `registra_fattura_dalla_posta` e di `esegui_azione_posta`
-- non ha lo stesso buco: le chiama il titolare col suo accesso, dalla
-- pagina Posta, e girano coi permessi del proprietario.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

create or replace function fattura_gia_registrata_per_la_posta(p_file_sdi text[])
returns table (invoice_number text, invoice_date date, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Al massimo due nomi: quello arrivato (.xml.p7m) e lo stesso senza .p7m.
  -- Una lista più lunga non è una domanda di posta-leggi: non si risponde.
  select si.invoice_number, si.invoice_date, si.created_at
    from supplier_invoices si
   where coalesce(array_length(p_file_sdi, 1), 0) between 1 and 2
     and si.file_sdi = any (p_file_sdi)
   order by si.created_at
   limit 1;
$$;

comment on function fattura_gia_registrata_per_la_posta(text[]) is
  'Per posta-leggi: dato il nome del file SdI (con e senza .p7m), dice numero, data e quando e'' stata registrata la fattura che porta quel file, oppure niente. Solo la chiave di servizio, che resta senza accesso a supplier_invoices (20260812000003).';
revoke all on function fattura_gia_registrata_per_la_posta(text[]) from public, anon, authenticated;
grant execute on function fattura_gia_registrata_per_la_posta(text[]) to service_role;

-- ---------------------------------------------------------------------
-- VERIFICA — in una sotto-transazione che viene ANNULLATA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_srls     uuid;
  v_piva     text;
  v_esito    jsonb;
  v_n        integer;
  v_numero   text;
  v_rifiuto  boolean;
begin
  -- (1) La chiave di servizio resta fuori dalle fatture: è la regola del 12/08.
  if has_table_privilege('service_role', 'supplier_invoices', 'select') then
    raise exception 'VERIFICA (1): il ruolo di servizio legge supplier_invoices, e non dovrebbe.';
  end if;
  -- (2) Solo la chiave di servizio chiama la domanda.
  if not has_function_privilege('service_role', 'fattura_gia_registrata_per_la_posta(text[])', 'execute') then
    raise exception 'VERIFICA (2): il servizio non puo'' chiedere se la fattura c''e'' gia''.';
  end if;
  if has_function_privilege('anon', 'fattura_gia_registrata_per_la_posta(text[])', 'execute')
     or has_function_privilege('authenticated', 'fattura_gia_registrata_per_la_posta(text[])', 'execute') then
    raise exception 'VERIFICA (2): la domanda e'' aperta anche a chi non e'' il servizio.';
  end if;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id, vat_number into v_srls, v_piva from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin
    -- Una fattura importata a mano come .xml (senza .p7m), come la 330/F.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_esito := registra_fattura_elettronica(v_srls, jsonb_build_object(
      'tipo', 'TD01', 'numero', 'ZZ-GIA-1', 'data', current_date::text,
      'totale', 122.00, 'imponibile', 100.00, 'imposta', 22.00,
      'file_sdi', 'ZZ00000000002_gia01.xml',
      'fornitore', jsonb_build_object('denominazione', 'ZZ fornitore gia'' registrato', 'partita_iva', 'IT09999999992'),
      'cliente', jsonb_build_object('partita_iva', v_piva)));
    reset role;
    perform set_config('request.jwt.claims', null, true);
    if (v_esito->>'fattura_id') is null then
      raise exception 'VERIFICA: la fattura di prova non e'' nata (%).', v_esito;
    end if;

    -- Da qui si parla come posta-leggi: la chiave di servizio.
    set local role service_role;

    -- (3) La lettura diretta, quella che falliva in produzione, resta vietata.
    v_rifiuto := false;
    begin
      perform 1 from supplier_invoices limit 1;
    exception when insufficient_privilege then v_rifiuto := true;
    end;
    if not v_rifiuto then raise exception 'VERIFICA (3): il servizio legge supplier_invoices.'; end if;

    -- (4) Arriva la .xml.p7m: trovata col nome senza .p7m, con numero e data.
    select f.invoice_number into v_numero
      from fattura_gia_registrata_per_la_posta(array['ZZ00000000002_gia01.xml.p7m', 'ZZ00000000002_gia01.xml']) f;
    if v_numero is distinct from 'ZZ-GIA-1' then
      raise exception 'VERIFICA (4): la fattura gia'' registrata non e'' stata trovata (%).', v_numero;
    end if;

    -- (5) Un file che non c'è: nessuna riga, nessun errore.
    select count(*) into v_n
      from fattura_gia_registrata_per_la_posta(array['ZZ00000000009_nuova.xml.p7m', 'ZZ00000000009_nuova.xml']);
    if v_n <> 0 then raise exception 'VERIFICA (5): un file nuovo risulta gia'' registrato.'; end if;

    -- (6) Una lista lunga non è una domanda di posta-leggi: nessuna risposta.
    select count(*) into v_n
      from fattura_gia_registrata_per_la_posta(array['a', 'b', 'ZZ00000000002_gia01.xml']);
    if v_n <> 0 then raise exception 'VERIFICA (6): una lista di tre nomi ha avuto risposta.'; end if;

    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della domanda «la fattura c''e'' gia''?»');

  raise notice 'Fatto: posta-leggi chiede se la fattura e'' gia'' registrata con una funzione sola, che risponde numero e data; la chiave di servizio resta senza accesso alle fatture. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261108000002', 'la_posta_chiede_se_la_fattura_c_e_gia')
on conflict (version) do nothing;
