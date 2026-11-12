-- =====================================================================
-- LA POSTA SA CHI L'HA MANDATA, E DICE L'IBAN NUOVO — 12/11/2026
-- =====================================================================
--
-- Revisione generale dell'11/11, punto 3: una fattura arrivata per posta
-- veniva presentata «arrivata dallo SdI» anche se l'aveva mandata chiunque.
-- Un truffatore poteva scrivere in un file-fattura il nome di un fornitore
-- vero e il proprio IBAN: compariva «Registra la fattura», la si
-- confermava, e poi si pagava l'IBAN sbagliato.
--
-- Due cose servono a `posta-leggi` per non crederci più:
--
--   · `posta_ricevuta.mittente_busta`: il mittente COM'È ARRIVATO. Per una
--     PEC è `posta-certificata@pec.aruba.it`, il gestore che la consegna;
--     la colonna `mittente` invece porta quello ripulito da mostrare
--     (08/11), e da lì non si distingue più una PEC vera dello SdI da una
--     mail normale con scritto «sdi01@pec.fatturapa.it». La scrive
--     `posta-in-arrivo`; le mail di prima restano vuote, e per
--     `posta-leggi` una mail senza questo dato NON viene dallo SdI.
--   · `iban_nuovi_per_la_posta`: dati la partita IVA del fornitore e gli
--     IBAN scritti nella fattura, dice quali non sono mai comparsi nelle
--     sue fatture già registrate (la nota «Da pagare su …» che la
--     registrazione scrive da sé). Solo la chiave di servizio, che resta
--     senza accesso alle fatture (20260812000003): risponde a questa sola
--     domanda, e non dice né importi né numeri.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IL MITTENTE COM'È ARRIVATO
-- ---------------------------------------------------------------------
alter table posta_ricevuta add column if not exists mittente_busta text;
comment on column posta_ricevuta.mittente_busta is
  'Il mittente com''è arrivato, prima di ogni pulizia (per una PEC: il gestore, posta-certificata@…). Serve a posta-leggi per sapere se una fattura viene davvero dallo SdI (12/11/2026). Vuoto sulle mail arrivate prima. ⚠️ dato personale.';

-- ---------------------------------------------------------------------
-- 2. GLI IBAN MAI VISTI PER QUESTO FORNITORE
-- ---------------------------------------------------------------------
create or replace function iban_nuovi_per_la_posta(p_partita_iva text, p_iban text[])
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- ⚠️ Senza partita IVA, o con un fornitore mai visto, sono nuovi TUTTI:
  --    il dubbio si dice, non si tace.
  with chiesti as (
    select distinct regexp_replace(upper(x), '[^A-Z0-9]', '', 'g') as iban
      from unnest(coalesce(p_iban, '{}'::text[])) as x
     where regexp_replace(upper(coalesce(x, '')), '[^A-Z0-9]', '', 'g') <> ''
  )
  select coalesce(array_agg(c.iban order by c.iban), '{}'::text[])
    from chiesti c
   -- ⚠️ Un «IBAN» corto si troverebbe dentro qualunque nota («IT», «1»):
   --    sotto i 15 caratteri (l'IBAN più corto d'Europa) è sempre nuovo.
   where length(c.iban) < 15
      or not exists (
     select 1
       from supplier_invoices si
       join suppliers s on s.id = si.supplier_id
      where partita_iva_normale(p_partita_iva) is not null
        and partita_iva_normale(s.tax_code) = partita_iva_normale(p_partita_iva)
        and position(c.iban in regexp_replace(upper(coalesce(si.note, '')), '[^A-Z0-9]', '', 'g')) > 0);
$$;
comment on function iban_nuovi_per_la_posta(text, text[]) is
  'Per posta-leggi (12/11/2026): gli IBAN di una fattura arrivata per posta che non sono mai comparsi nelle fatture già registrate dello stesso fornitore (per partita IVA). Tutti, se il fornitore non c''è. Solo la chiave di servizio, che resta senza accesso a supplier_invoices.';
revoke all on function iban_nuovi_per_la_posta(text, text[]) from public, anon, authenticated;
grant execute on function iban_nuovi_per_la_posta(text, text[]) to service_role;

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
  v_nuovi    text[];
  v_rifiuto  boolean;
begin
  -- (1) La colonna c'è, e la chiave di servizio la può scrivere.
  if not exists (select 1 from information_schema.columns
                  where table_name = 'posta_ricevuta' and column_name = 'mittente_busta') then
    raise exception 'VERIFICA (1): manca posta_ricevuta.mittente_busta.';
  end if;
  if not has_column_privilege('service_role', 'posta_ricevuta', 'mittente_busta', 'insert') then
    raise exception 'VERIFICA (1): posta-in-arrivo non puo'' scrivere il mittente com''e'' arrivato.';
  end if;

  -- (2) Solo la chiave di servizio fa la domanda; le fatture restano chiuse.
  if not has_function_privilege('service_role', 'iban_nuovi_per_la_posta(text, text[])', 'execute') then
    raise exception 'VERIFICA (2): il servizio non puo'' chiedere gli IBAN nuovi.';
  end if;
  if has_function_privilege('anon', 'iban_nuovi_per_la_posta(text, text[])', 'execute')
     or has_function_privilege('authenticated', 'iban_nuovi_per_la_posta(text, text[])', 'execute') then
    raise exception 'VERIFICA (2): la domanda sugli IBAN e'' aperta anche a chi non e'' il servizio.';
  end if;
  if has_table_privilege('service_role', 'supplier_invoices', 'select') then
    raise exception 'VERIFICA (2): il ruolo di servizio legge supplier_invoices, e non dovrebbe.';
  end if;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id, vat_number into v_srls, v_piva from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin
    -- Una fattura già registrata, con l'IBAN scritto come lo scrive la registrazione.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_esito := registra_fattura_elettronica(v_srls, jsonb_build_object(
      'tipo', 'TD01', 'numero', 'ZZ-IBAN-1', 'data', current_date::text,
      'totale', 122.00, 'imponibile', 100.00, 'imposta', 22.00,
      'file_sdi', 'ZZ00000000003_iban1.xml',
      'note', 'Dalla fattura elettronica ZZ00000000003_iban1.xml. Da pagare su IT60 X054 2811 1010 0000 0123 456.',
      'fornitore', jsonb_build_object('denominazione', 'ZZ fornitore con IBAN', 'partita_iva', 'IT09999999993'),
      'cliente', jsonb_build_object('partita_iva', v_piva)));
    reset role;
    perform set_config('request.jwt.claims', null, true);
    if (v_esito->>'fattura_id') is null then
      raise exception 'VERIFICA: la fattura di prova non e'' nata (%).', v_esito;
    end if;

    set local role service_role;

    -- (3) Quello già visto non è nuovo, scritto in qualunque modo; l'altro sì.
    v_nuovi := iban_nuovi_per_la_posta('09999999993',
      array['it60x0542811101000000123456', 'IT02 L123 4512 3451 2345 6789 012']);
    if v_nuovi is distinct from array['IT02L1234512345123456789012'] then
      raise exception 'VERIFICA (3): gli IBAN nuovi non sono quelli attesi (%).', v_nuovi;
    end if;

    -- (4) Un fornitore mai visto, o senza partita IVA: tutti nuovi.
    v_nuovi := iban_nuovi_per_la_posta('IT09999999994', array['IT60X0542811101000000123456']);
    if v_nuovi is distinct from array['IT60X0542811101000000123456'] then
      raise exception 'VERIFICA (4): l''IBAN di un fornitore nuovo non risulta nuovo (%).', v_nuovi;
    end if;
    v_nuovi := iban_nuovi_per_la_posta(null, array['IT60X0542811101000000123456']);
    if v_nuovi is distinct from array['IT60X0542811101000000123456'] then
      raise exception 'VERIFICA (4): senza partita IVA l''IBAN non risulta nuovo (%).', v_nuovi;
    end if;

    -- (4bis) Un pezzo corto che sta dentro la nota non diventa «noto».
    v_nuovi := iban_nuovi_per_la_posta('IT09999999993', array['IT60', '123456']);
    if v_nuovi is distinct from array['123456', 'IT60'] then
      raise exception 'VERIFICA (4bis): un pezzo d''IBAN corto risulta gia'' noto (%).', v_nuovi;
    end if;

    -- (5) Niente IBAN: niente da dire.
    if iban_nuovi_per_la_posta('IT09999999993', array[]::text[]) <> '{}'::text[]
       or iban_nuovi_per_la_posta('IT09999999993', null) <> '{}'::text[] then
      raise exception 'VERIFICA (5): senza IBAN la risposta non e'' vuota.';
    end if;

    -- (6) La lettura diretta delle fatture resta vietata.
    v_rifiuto := false;
    begin
      perform 1 from supplier_invoices limit 1;
    exception when insufficient_privilege then v_rifiuto := true;
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6): il servizio legge supplier_invoices.'; end if;

    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del mittente com''e'' arrivato e degli IBAN nuovi');

  raise notice 'Fatto: la posta conserva il mittente com''e'' arrivato, e posta-leggi chiede quali IBAN di una fattura sono nuovi per quel fornitore senza leggere le fatture. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000003', 'la_posta_sa_chi_l_ha_mandata')
on conflict (version) do nothing;
