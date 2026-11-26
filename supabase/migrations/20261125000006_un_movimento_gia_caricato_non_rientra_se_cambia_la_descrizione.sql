-- 25/11/2026 — Revisione dell'11/11, punto 30: CSV Credem, se la banca cambia descrizione o note di un movimento già
-- scaricato, quel movimento rientra come nuovo.
--
-- Cosa succedeva: l'impronta di un movimento del CSV contiene anche la descrizione e le note. Se la banca riesporta la
-- stessa riga con una nota in più (o la descrizione accorciata), l'impronta cambia e il movimento entra una seconda volta.
-- Misurato il 25/11 su un file vero: oggi non succede (note vuote, descrizioni intere) e i 25 movimenti già su work
-- coincidono con quelli del file; ma una nota aggiunta farebbe risultare «nuovi» tutti i movimenti.
--
-- Cura (seconda difesa, l'impronta di oggi resta com'è e nessun dato esistente si tocca): un movimento che porta il
-- «rif. banca» (i bonifici) è lo STESSO di uno già caricato quando coincidono conto, data contabile, data valuta, importo,
-- causale e rif. banca. Si conta, non si cancella: se nel file ce ne sono N uguali e sul conto già M, entrano solo gli
-- N − M in più (due bonifici uguali davvero restano due). Quelli saltati per questa regola si dicono: «già presenti
-- (descrizione cambiata)».
-- Limite dichiarato: commissioni, bolli e canoni NON portano il rif. banca, quindi per loro vale solo l'impronta.
-- Due bonifici dello stesso giorno con lo stesso rif. banca ma importo diverso restano entrambi (l'importo fa parte della chiave).

create or replace function carica_movimenti_banca(p_iban text, p_flusso text, p_movimenti jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_iban     text := regexp_replace(upper(coalesce(p_iban, '')), '[^A-Z0-9]', '', 'g');
  v_conto    conti_bancari%rowtype;
  v_tot      integer := coalesce(jsonb_array_length(p_movimenti), 0);
  v_nuovi    integer;
  v_cambiati integer;
  m          jsonb;
begin
  if not is_titolare() then
    raise exception 'Caricare i movimenti della banca e'' riservato al titolare.';
  end if;
  if v_iban = '' then
    raise exception 'Il file della banca non dice di quale conto si tratta.';
  end if;
  if nullif(btrim(coalesce(p_flusso, '')), '') is null then
    raise exception 'Manca il nome del file della banca.';
  end if;

  select * into v_conto
    from conti_bancari c
   where regexp_replace(upper(coalesce(c.iban, '')), '[^A-Z0-9]', '', 'g') = v_iban;
  if v_conto.id is null then
    raise exception 'Il conto % non e'' fra i tuoi conti correnti: aggiungilo da Cassa → Conti correnti con questo IBAN, poi ricarica il file.', v_iban;
  end if;
  if not v_conto.attivo then
    raise exception 'Il conto «%» e'' segnato come chiuso: riaprilo da Cassa → Conti correnti se vuoi caricarne i movimenti.', v_conto.nome;
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_movimenti, '[]'::jsonb)) loop
    if nullif(m->>'impronta', '') is null or nullif(m->>'importo', '') is null
       or nullif(m->>'data_contabile', '') is null or nullif(m->>'data_valuta', '') is null then
      raise exception 'Un movimento del file e'' incompleto: non si carica niente.';
    end if;
  end loop;

  -- ⚠️ Prima si guarda quali righe del file hanno GIÀ la loro impronta sul conto: quelle sono le stesse righe e non
  --    contano come «uguali da coprire». Le posizioni (rn) si danno solo alle altre, così un gemello vero con
  --    un'impronta nuova non viene scambiato per la riga già presente (rilievo della revisione ECC).
  with base as (
    select x.v as x, x.n,
           nullif(x.v->>'riferimento_banca', '') as rif,
           (x.v->>'data_contabile')::date as dc,
           (x.v->>'data_valuta')::date as dv,
           round((x.v->>'importo')::numeric, 2) as imp,
           coalesce(x.v->>'causale_abi', '') as abi,
           exists (select 1 from movimenti_banca e
                    where e.conto_id = v_conto.id and e.impronta = x.v->>'impronta') as esiste
      from jsonb_array_elements(coalesce(p_movimenti, '[]'::jsonb)) with ordinality as x(v, n)
  ),
  righe_file as (
    select b.*,
           row_number() over (partition by b.rif, b.dc, b.dv, b.imp, b.abi, b.esiste order by b.n) as rn,
           count(*) filter (where b.esiste) over (partition by b.rif, b.dc, b.dv, b.imp, b.abi) as gia_riconosciute
      from base b
  ),
  gia as (
    -- Coperta = non ha la sua impronta, ha il rif. banca, e sul conto restano M − K righe con la stessa chiave
    -- non riconosciute per impronta (M = quelle sul conto, K = quelle del file che hanno già la loro impronta):
    -- le prime M − K righe nuove del file con quella chiave sono le stesse, cambiate; le altre sono nuove davvero.
    select f.x,
           (not f.esiste
            and f.rif is not null
            and f.rn <= (select count(*) from movimenti_banca e
                          where e.conto_id = v_conto.id
                            and e.riferimento_banca = f.rif
                            and e.data_contabile = f.dc
                            and e.data_valuta = f.dv
                            and round(e.importo, 2) = f.imp
                            and coalesce(e.causale_abi, '') = f.abi) - f.gia_riconosciute
           ) as coperta,
           f.esiste
      from righe_file f
  ),
  nuovi as (
    insert into movimenti_banca (
      conto_id, impronta, data_contabile, data_valuta, importo, causale_abi,
      causale_interna, riferimento_banca, numero_assegno, descrizione, dettagli,
      iban_controparte, flusso)
    select v_conto.id, g.x->>'impronta', (g.x->>'data_contabile')::date, (g.x->>'data_valuta')::date,
           (g.x->>'importo')::numeric, nullif(g.x->>'causale_abi', ''), nullif(g.x->>'causale_interna', ''),
           nullif(g.x->>'riferimento_banca', ''), nullif(g.x->>'numero_assegno', ''),
           coalesce(g.x->>'descrizione', ''), nullif(g.x->>'dettagli', ''),
           nullif(g.x->>'iban_controparte', ''), btrim(p_flusso)
      from gia g
     where not g.coperta
    on conflict (conto_id, impronta) do nothing
    returning 1
  )
  select (select count(*) from nuovi),
         (select count(*) from gia g where g.coperta)
    into v_nuovi, v_cambiati;

  return jsonb_build_object('conto', v_conto.nome, 'nuovi', v_nuovi, 'gia_presenti', v_tot - v_nuovi,
                            'descrizione_cambiata', v_cambiati);
end $fn$;

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui; i movimenti già su work non si toccano)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit  uuid;
  v_ent  uuid;
  v_r    jsonb;
  v_iban constant text := 'IT00Z0000000000000ZZ9999';
  v_n    integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ent from entities limit 1;
  if v_tit is null or v_ent is null then raise exception 'VERIFICA: manca un titolare o un''entità.'; end if;

  begin
    insert into conti_bancari (entity_id, nome, iban, attivo) values (v_ent, 'ZZ conto verifica', v_iban, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- (1) due bonifici dello stesso giorno, STESSO rif. banca ma importo diverso: entrano entrambi.
    v_r := carica_movimenti_banca(v_iban, 'zz.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§a1', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -1500,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico a'),
      jsonb_build_object('impronta', 'zz§b1', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -47,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico b')));
    if (v_r->>'nuovi')::integer <> 2 then raise exception 'VERIFICA (1): due bonifici con lo stesso rif. ma importo diverso: nuovi %.', v_r->>'nuovi'; end if;

    -- (2) gli stessi due con la descrizione cambiata (impronte diverse): NON rientrano, e lo dice.
    v_r := carica_movimenti_banca(v_iban, 'zz2.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§a2', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -1500,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico a con nota nuova'),
      jsonb_build_object('impronta', 'zz§b2', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -47,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico b accorciato')));
    if (v_r->>'nuovi')::integer <> 0 or (v_r->>'descrizione_cambiata')::integer <> 2 or (v_r->>'gia_presenti')::integer <> 2 then
      raise exception 'VERIFICA (2): descrizione cambiata: %.', v_r;
    end if;

    -- (3) un bonifico uguale davvero arrivato dopo (due nel file, uno già sul conto): entra solo il secondo.
    v_r := carica_movimenti_banca(v_iban, 'zz3.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§a3', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -1500,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico a'),
      jsonb_build_object('impronta', 'zz§a4', 'data_contabile', '2026-10-01', 'data_valuta', '2026-10-01', 'importo', -1500,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF1', 'descrizione', 'bonifico a')));
    if (v_r->>'nuovi')::integer <> 1 then raise exception 'VERIFICA (3): due uguali nel file e uno già sul conto: nuovi %.', v_r->>'nuovi'; end if;

    -- (3b) un gemello vero con impronta NUOVA scritto PRIMA della riga già presente: entra (non va perso).
    v_r := carica_movimenti_banca(v_iban, 'zz3b.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§d1', 'data_contabile', '2026-10-05', 'data_valuta', '2026-10-05', 'importo', -10,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF2', 'descrizione', 'bonifico d')));
    v_r := carica_movimenti_banca(v_iban, 'zz3c.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§d2', 'data_contabile', '2026-10-05', 'data_valuta', '2026-10-05', 'importo', -10,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF2', 'descrizione', 'bonifico d gemello'),
      jsonb_build_object('impronta', 'zz§d1', 'data_contabile', '2026-10-05', 'data_valuta', '2026-10-05', 'importo', -10,
                         'causale_abi', '26', 'riferimento_banca', 'ZZRIF2', 'descrizione', 'bonifico d')));
    if (v_r->>'nuovi')::integer <> 1 or (v_r->>'descrizione_cambiata')::integer <> 0 then
      raise exception 'VERIFICA (3b): il gemello vero scritto prima della riga già presente: %.', v_r;
    end if;

    -- (4) senza rif. banca (commissioni, bolli): vale solo l'impronta, come prima.
    v_r := carica_movimenti_banca(v_iban, 'zz4.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§c1', 'data_contabile', '2026-10-02', 'data_valuta', '2026-10-03', 'importo', -1,
                         'causale_abi', '16', 'descrizione', 'commissione')));
    v_r := carica_movimenti_banca(v_iban, 'zz5.csv', jsonb_build_array(
      jsonb_build_object('impronta', 'zz§c1', 'data_contabile', '2026-10-02', 'data_valuta', '2026-10-03', 'importo', -1,
                         'causale_abi', '16', 'descrizione', 'commissione')));
    if (v_r->>'nuovi')::integer <> 0 or (v_r->>'gia_presenti')::integer <> 1 then raise exception 'VERIFICA (4): stessa impronta senza rif.: %.', v_r; end if;

    select count(*) into v_n from movimenti_banca where conto_id = (select id from conti_bancari where iban = v_iban);
    if v_n <> 6 then raise exception 'VERIFICA (5): sul conto di prova ci sono % movimenti invece di 6.', v_n; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  if exists (select 1 from conti_bancari where iban = v_iban) then
    raise exception 'VERIFICA (6): resta un residuo della verifica.';
  end if;
  raise notice 'Fatto: un movimento con rif. banca già caricato non rientra se cambia la descrizione (e lo dice); due bonifici con lo stesso rif. e importi diversi restano entrambi. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000006', 'un_movimento_gia_caricato_non_rientra_se_cambia_la_descrizione')
on conflict (version) do nothing;
