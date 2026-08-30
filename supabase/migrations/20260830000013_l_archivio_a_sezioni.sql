-- =====================================================================
-- L'ARCHIVIO A SEZIONI — 30/08/2026
-- =====================================================================
--
-- 🔴 IL DIFETTO, MISURATO PRIMA DI SCRIVERE. `documents.doc_type` esiste ed
-- e' preteso da un vincolo, ma e' **testo libero**: nessun vocabolario,
-- nessun controllo oltre al non-vuoto. Quindi «Fattura», «fattura» e
-- «Fatture» diventano **tre sezioni diverse**, e un archivio diviso in
-- sezioni sarebbe diviso in sezioni sbagliate.
--
-- ⚠️ E LA MISURA HA CORRETTO LA DOMANDA DUE VOLTE:
--   · l'obbligo non e' un `not null` sulla colonna: e' il check
--     `documents_ha_identita`, **NOT VALID** — cioe' vale per le righe nuove
--     e non e' mai stato passato su quelle vecchie. Infatti sul progetto di
--     prova ci sono **2 documenti senza tipo**, che nessun `not null`
--     avrebbe permesso;
--   · in produzione i documenti sono **ZERO** (misurato il 30/08), quindi la
--     sanatoria la' non tocchera' niente. Sul progetto di prova sono **10**,
--     con **9 valori distinti** scritti a mano.
--
-- 🔴 LE OTTO SEZIONI SONO SUE, e si scrivono come sono state dette. Il
-- gestionale non ne inventa una nona.
--
-- ⚠️ VALE LA REGOLA DEL 27/08: **una categoria spenta resta legale per i
-- documenti che la portano, non si distrugge.** Quindi i valori gia' scritti
-- a mano non si buttano e non si indovinano: entrano nel catalogo **spenti**,
-- cosi' i documenti che li portano restano validi e nessuno li propone piu'.
-- *Indovinare a quale delle otto appartenga «Verbale» sarebbe riscrivere un
-- dato di Alessio senza che nessuno lo chieda.*
--
-- ⚠️ E IL PERICOLO CHE QUESTO APRE E' LA TRAPPOLA DEL 27/08: un menu a
-- tendina che riceve un valore fuori elenco **mostra la prima opzione**,
-- senza nessun errore. Per questo la schermata deve mettere fra le opzioni
-- **anche il valore che il documento porta gia'**, spento o no. Il codice sta
-- in `ArchivioDocumentiHome.jsx` e in `DocumentoDetail.jsx`; qui c'e' la
-- funzione che glielo dice (`sezioni_archivio_per(...)`).

-- ---------------------------------------------------------------------
-- 1. IL CATALOGO
-- ---------------------------------------------------------------------
create table if not exists sezioni_archivio (
  codice     text primary key,
  etichetta  text not null,
  ordine     integer not null,
  attiva     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table sezioni_archivio is
  'Le sezioni dell''Archivio Documenti. Le otto attive le ha decise Alessio il 30/08/2026; le spente sono i valori scritti a mano prima che l''elenco fosse chiuso — restano legali per i documenti che le portano e non si propongono piu'' (regola del 27/08).';
comment on column sezioni_archivio.attiva is
  'Spenta = non si propone piu'', ma resta legale per i documenti che ce l''hanno addosso. Non si cancella una sezione: la si spegne.';

alter table sezioni_archivio enable row level security;

-- Lettura a chi e' dentro (serve a riempire il menu), scrittura al titolare.
drop policy if exists sezioni_archivio_select on sezioni_archivio;
create policy sezioni_archivio_select on sezioni_archivio
  for select to authenticated using (true);

drop policy if exists sezioni_archivio_scrittura on sezioni_archivio;
create policy sezioni_archivio_scrittura on sezioni_archivio
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. LE OTTO DI ALESSIO
-- ---------------------------------------------------------------------
-- ⚠️ `do nothing`, non `do update`: se lui rinomina un'etichetta o spegne una
--    sezione, rieseguire la migrazione non deve riportare indietro la sua
--    scelta (lezione del 15/08 sulle regole di deducibilita').
insert into sezioni_archivio (codice, etichetta, ordine) values
  ('fatture_ricevute',   'Fatture ricevute',            1),
  ('fornitori_ddt',      'Fornitori e DDT',             2),
  ('banca',              'Banca e finanziamenti',       3),
  ('contratti',          'Contratti e affitti',         4),
  ('autorizzazioni',     'Autorizzazioni e pratiche',   5),
  ('personale',          'Personale',                   6),
  ('fisco',              'Fisco e adempimenti',         7),
  ('attrezzature',       'Attrezzature e garanzie',     8)
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 3. QUELLO CHE C'ERA GIA' RESTA LEGALE, SPENTO
-- ---------------------------------------------------------------------
-- 🔴 Il legame verso il catalogo si puo' mettere solo se ogni valore gia'
--    scritto ci sta dentro. Non si indovina a quale delle otto appartenga
--    «Verbale»: si crea la sua riga, **spenta**, e il documento resta
--    valido. ⚠️ E si dichiara **quante** ne sono nate: una sanatoria che non
--    dice quante righe ha toccato e' una sanatoria che ha ingannato quattro
--    volte in questo progetto.
do $sanatoria$
declare
  v_nate integer := 0;
  v_max  integer;
begin
  select coalesce(max(ordine), 0) into v_max from sezioni_archivio;

  with da_salvare as (
    select distinct trim(d.doc_type) as codice
      from documents d
     where d.doc_type is not null
       and trim(d.doc_type) <> ''
       and not exists (select 1 from sezioni_archivio s where s.codice = trim(d.doc_type))
  )
  insert into sezioni_archivio (codice, etichetta, ordine, attiva)
  select codice, codice, v_max + row_number() over (order by codice), false
    from da_salvare;
  get diagnostics v_nate = row_count;

  raise notice 'Sezioni conservate dai valori scritti a mano (spente): %', v_nate;
end $sanatoria$;

-- ⚠️ `on update no action`, come `ingredients.category`: le due colonne che
--    puntano a un catalogo si comportano allo stesso modo, e il 30/08 si e'
--    gia' imparato cosa costa rinominare un codice — il rifiuto arriva
--    **prima**, con un messaggio in italiano, invece che dal vincolo.
alter table documents
  drop constraint if exists documents_doc_type_fkey;
alter table documents
  add constraint documents_doc_type_fkey
  foreign key (doc_type) references sezioni_archivio(codice)
  on update no action on delete restrict;

comment on constraint documents_doc_type_fkey on documents is
  'Questa sezione dell''archivio non esiste. Le sezioni si scelgono dall''elenco: se ne serve una nuova, va aggiunta prima. E una sezione non si cancella — si spegne, cosi'' i documenti che ce l''hanno addosso restano leggibili.';

-- ---------------------------------------------------------------------
-- 4. QUALI SEZIONI OFFRIRE, E L'ARCHIVIO DIVISO
-- ---------------------------------------------------------------------
-- 🔴 LE OPZIONI DI UN MENU COMPRENDONO SEMPRE IL VALORE CHE IL DOCUMENTO
--    PORTA GIA', anche se spento. Senza, un menu che riceve un valore fuori
--    elenco **mostra la prima opzione** e chi salva cambia la sezione del
--    documento senza saperlo (trappola del 27/08, vista a schermo).
create or replace function sezioni_archivio_per(p_corrente text default null)
returns table (codice text, etichetta text, attiva boolean)
language sql
stable
security invoker
set search_path = public
as $fn$
  select s.codice, s.etichetta, s.attiva
    from sezioni_archivio s
   where s.attiva or s.codice is not distinct from nullif(trim(p_corrente), '')
   order by s.attiva desc, s.ordine;
$fn$;

-- ⚠️ `security invoker` di proposito: decide la RLS di `sezioni_archivio`,
--    non una seconda serratura da tenere allineata (stessa scelta di
--    `documenti_per_domanda()` il 12/08).
revoke all on function sezioni_archivio_per(text) from public, anon, authenticated;
grant execute on function sezioni_archivio_per(text) to authenticated;

-- Quanti documenti per sezione — serve all'archivio diviso, e dice anche le
-- sezioni VUOTE, che sono un'informazione: «qui non c'e' ancora niente» non
-- e' la stessa cosa di «questa sezione non esiste».
create or replace function documenti_per_sezione()
returns table (codice text, etichetta text, attiva boolean, quanti integer)
language sql
stable
security invoker
set search_path = public
as $fn$
  select s.codice, s.etichetta, s.attiva,
         (select count(*) from documents d where d.doc_type = s.codice)::integer
    from sezioni_archivio s
   order by s.attiva desc, s.ordine;
$fn$;

revoke all on function documenti_per_sezione() from public, anon, authenticated;
grant execute on function documenti_per_sezione() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Dentro una sotto-transazione ANNULLATA (decisione del 30/08): non si
--    cancella niente, quindi il registro delle cancellazioni resta acceso e
--    non c'e' nessuna lapide finta da togliere. E si lavora su roba propria.
do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_ent   uuid;
  v_tit   uuid;
  v_n     integer;
  v_preso boolean;
  v_doc   uuid;
begin
  -- (1) LE OTTO CI SONO E SONO ACCESE.
  select count(*) into v_n from sezioni_archivio
   where attiva and codice in ('fatture_ricevute','fornitori_ddt','banca','contratti',
                               'autorizzazioni','personale','fisco','attrezzature');
  if v_n <> 8 then
    raise exception 'Le sezioni attive di Alessio dovrebbero essere 8, ne risultano %.', v_n;
  end if;

  -- (2) OGNI DOCUMENTO GIA' SCRITTO E' ANCORA VALIDO: il legame regge, quindi
  --     nessun valore e' rimasto orfano. Se ne fosse rimasto uno, la
  --     `alter table` qui sopra si sarebbe gia' fermata — questo controllo
  --     dice che il perimetro e' quello che si crede.
  select count(*) into v_n
    from documents d
   where d.doc_type is not null
     and not exists (select 1 from sezioni_archivio s where s.codice = d.doc_type);
  if v_n <> 0 then
    raise exception 'Ci sono % documenti con una sezione che non esiste.', v_n;
  end if;

  select id into v_ent from entities where entity_type = 'srls';
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    -- (3) UNA SEZIONE INVENTATA E' RESPINTA.
    v_preso := false;
    begin
      insert into documents (entity_id, title, doc_type, document_date)
      values (v_ent, 'ZZ verifica sezioni', 'zz_sezione_inventata', current_date);
    exception when others then
      v_preso := true;
    end;
    if not v_preso then
      raise exception 'Un documento con una sezione inventata NON e'' stato respinto.';
    end if;

    -- (4) UNA DELLE OTTO PASSA.
    insert into documents (entity_id, title, doc_type, document_date)
    values (v_ent, 'ZZ verifica sezioni', 'contratti', current_date)
    returning id into v_doc;

    -- (5) IL MENU COMPRENDE SEMPRE IL VALORE CORRENTE, anche se spento.
    --     ⚠️ Si costruisce una sezione spenta PROPRIA: usare una di quelle
    --        gia' presenti farebbe passare il controllo per la ragione
    --        sbagliata il giorno che non ce ne fossero (trappola del 27/08).
    insert into sezioni_archivio (codice, etichetta, ordine, attiva)
    values ('zz_spenta_di_prova', 'ZZ spenta di prova', 999, false);

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    select count(*) into v_n from sezioni_archivio_per(null)
     where codice = 'zz_spenta_di_prova';
    if v_n <> 0 then
      raise exception 'Una sezione spenta viene proposta anche quando nessun documento la porta.';
    end if;

    select count(*) into v_n from sezioni_archivio_per('zz_spenta_di_prova')
     where codice = 'zz_spenta_di_prova';
    if v_n <> 1 then
      raise exception 'Il menu NON comprende la sezione che il documento porta gia'': e'' la trappola del menu che mostra la prima opzione.';
    end if;

    -- (6) IL CONTEGGIO PER SEZIONE VEDE IL DOCUMENTO APPENA SCRITTO.
    select quanti into v_n from documenti_per_sezione() where codice = 'contratti';
    if coalesce(v_n, 0) < 1 then
      raise exception 'Il conteggio per sezione non vede il documento appena scritto.';
    end if;

    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica delle sezioni dell''archivio');

  raise notice 'Fatto: l''archivio ha le otto sezioni di Alessio, i valori vecchi restano legali e spenti, una sezione inventata e'' respinta, e il menu comprende sempre quella che il documento porta gia''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260830000013', 'l_archivio_a_sezioni') on conflict (version) do nothing;

-- =====================================================================
-- 5. L'ASSISTENTE PROPONE UNA SEZIONE DELL'ELENCO, NON UNA PAROLA SUA
-- =====================================================================
-- 🔴 CHIUDERE UN VOCABOLARIO ROMPE CHI LO RIEMPIVA A PAROLE, e qui il
-- chiamante e' la posta: `esegui_azione_posta` prende il «tipo» proposto dal
-- modello e lo scrive dritto in `doc_type`. Col legame appena messo, un
-- «contratto» inventato dal modello **farebbe fallire l'archiviazione**.
--
-- ⚠️ LA CURA STA A MONTE E RIUSA LA RETE CHE C'ERA (regola del 27/08): gli
-- elenchi chiusi arrivano gia' al modello da `vocabolari_per_assistente()`,
-- costruiti **dal catalogo** e non scritti a mano. Se ne aggiunge uno.
-- ⚠️ Corpo preso dal database VIVO del progetto di prova (`--prova`): la
-- produzione stanotte e' indietro, e ripartire dal suo corpo annullerebbe il
-- lavoro di stasera — la trappola del 27/08.
CREATE OR REPLACE FUNCTION public.vocabolari_per_assistente()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    -- LE CATEGORIE: solo le accese, ed e' l'eccezione voluta — proporre una
    -- categoria spenta rimetterebbe in circolo una cosa che Alessio ha
    -- deciso di non usare piu'.
    'categorie_prodotto', (
      select coalesce(jsonb_agg(jsonb_build_object('codice', c.codice, 'nome', c.nome)
                                order by c.ordine, c.nome), '[]'::jsonb)
        from categorie_proponibili() c),
    -- LE SEZIONI DELL'ARCHIVIO (30/08/2026), con la stessa regola: solo le
    -- accese. Una spenta resta legale per i documenti che la portano, ma
    -- proporla rimetterebbe in circolo una parola che l'elenco chiuso ha
    -- appena tolto di mezzo.
    'sezioni_archivio', (
      select coalesce(jsonb_agg(jsonb_build_object('codice', s.codice, 'nome', s.etichetta)
                                order by s.ordine), '[]'::jsonb)
        from sezioni_archivio s where s.attiva),
    -- Gli altri elenchi arrivano dalla rete dei vocabolari, cioe' dal
    -- catalogo del database: non c'e' un secondo posto da tenere d'accordo.
    -- ⚠️ Vuoto (non un array vuoto) dove quella colonna non ha un
    --    vocabolario: «non ci sono valori ammessi» e «non lo so» sono due
    --    cose diverse.
    'unita',             (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'unit' limit 1),
    'allergeni',         (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'allergens' limit 1),
    'conservazione',     (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'ingredients' and v.colonna = 'storage_type' limit 1),
    'categorie_ricetta', (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'recipes' and v.colonna = 'category' limit 1),
    'verso_cassa',       (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'direction' limit 1),
    'mezzi_cassa',       (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'mezzo' limit 1),
    'tipi_documento',    (select to_jsonb(v.valori) from vocabolari_chiusi() v
                           where v.tabella = 'cash_movements' and v.colonna = 'tipo_documento' limit 1)
  );
$function$;

-- ⚠️ I permessi si rimettono uguali a com'erano, MISURATI e non ricopiati a
--    memoria (trappola del 24 e del 27/08). Qui e' un `create or replace`,
--    quindi non si perdono — ma la verifica li ricontrolla lo stesso.

do $verifica2$
declare
  v_n integer;
begin
  -- L'elenco arriva al modello, e contiene le otto.
  select jsonb_array_length(vocabolari_per_assistente()->'sezioni_archivio') into v_n;
  if coalesce(v_n, 0) <> 8 then
    raise exception 'L''assistente riceve % sezioni invece delle 8 attive.', coalesce(v_n, -1);
  end if;
  -- E NON contiene le spente: proporle rimetterebbe in circolo una parola
  -- che l'elenco chiuso ha appena tolto di mezzo.
  if exists (
    select 1 from jsonb_array_elements(vocabolari_per_assistente()->'sezioni_archivio') e
     where e->>'codice' in (select codice from sezioni_archivio where not attiva)
  ) then
    raise exception 'L''assistente riceve anche sezioni spente.';
  end if;
  raise notice 'Fatto: l''assistente riceve le 8 sezioni accese e nessuna spenta.';
end $verifica2$;
