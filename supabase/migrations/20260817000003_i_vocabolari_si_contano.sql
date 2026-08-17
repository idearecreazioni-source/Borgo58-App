-- I vocabolari chiusi si contano da soli.
--
-- LA TRAPPOLA, terza ricomparsa in due giorni: un elenco chiuso di valori
-- ammessi vive in **piu' di un posto**, e nessuno controlla che i posti
-- dicano la stessa cosa.
--   · 16/08 — gli scarichi di magazzino: aperto il vocabolario nella
--     funzione e non nel vincolo della tabella. Il primo vitto del
--     personale sarebbe fallito con un errore incomprensibile;
--   · 17/08 — i metodi di pagamento: identico, e me ne sono accorto
--     applicando;
--   · 17/08 — e guardando per costruire questa rete: **«Assegno» compare
--     nel menu della lista della spesa, dove il database lo rifiuta.** Vive
--     in produzione da ieri, e questa e' la terza faccia della stessa cosa.
--
-- ⚠️ I POSTI SONO TRE, NON DUE, e la scoperta cambia la forma della rete:
--   1. **il database decide** — un tipo `enum` oppure un vincolo `check`;
--   2. **una funzione ridice l'elenco** per poter dare un messaggio
--      leggibile invece di un errore di vincolo;
--   3. **il JavaScript ridice l'elenco** per riempire un menu a tendina.
--
-- E i tre sbagliano in modi diversi. Fra 1 e 2 l'errore e' **rumoroso ma
-- incomprensibile**, e arriva al primo uso vero. Fra 1 e 3, se il
-- JavaScript e' piu' STRETTO, l'errore e' **silenzioso**: un valore
-- legittimo semplicemente non si puo' scegliere, e nessuno lo scopre. Se e'
-- piu' LARGO — il caso dell'assegno — il salvataggio fallisce sull'unica
-- persona che ci prova.
--
-- ⚠️ PERCHE' UNA RETE E NON UN «RIFLESSO». La regola del 16/08 dice che
-- quando due posti direbbero la stessa cosa, il secondo va reso un riflesso
-- del primo invece di costruirgli un guardiano. Qui non si applica, e vale
-- la pena scrivere perche': i tre posti **non dicono la stessa cosa**. Il
-- database dice *quali valori sono legali*, il JavaScript dice *come si
-- scrivono in italiano* — e le etichette italiane sono roba della
-- schermata, non del database. Cio' che si sovrappone e' solo l'insieme
-- delle chiavi, e su quello serve un guardiano.
--
-- Questa migrazione porta solo i due ELENCHI, che si costruiscono da soli
-- interrogando il database. Il confronto — compreso il terzo posto, che sta
-- nel bundle e che il database non puo' vedere — vive in
-- `tests/app/vocabolari.test.js`, con le eccezioni dichiarate una per una
-- in `src/lib/calcoli/vocabolari.js`.

-- =====================================================================
-- 1. Quali vocabolari chiusi esistono nel database
-- =====================================================================
--
-- ⚠️ Non c'e' nessun elenco scritto a mano: si legge dai cataloghi. Un
-- vocabolario nuovo aggiunto domani compare qui da solo, e la prova diventa
-- rossa finche' qualcuno non dichiara se la schermata lo rispecchia. E'
-- la stessa forma di `funzioni_aperte_ad_anon()` (13/08) e di
-- `npm run prova:stato` (16/08): un elenco che si costruisce da solo chiede
-- di piu' man mano che il gestionale cresce, invece di invecchiare.
-- ⚠️ `predefinito` non e' un ornamento: e' la colonna che dice **dove un
-- disaccordo sarebbe SILENZIOSO.** Se la colonna ha un valore predefinito e
-- la schermata dimentica di passare il campo, il database non da' errore —
-- scrive il predefinito. E' esattamente come si e' perso il `mezzo` delle
-- mance il 16/08: il menu c'era, si vedeva, e ogni mancia su carta finiva
-- nel contante del cassetto. Dove il predefinito non c'e', la stessa
-- dimenticanza fallisce rumorosamente.
--
-- Serve al giro dopo — camminare quell'elenco — e sta qui perche' se lo
-- costruisca il database invece di ricordarselo qualcuno.
--
-- ⚠️ Il tipo di ritorno cambia: `create or replace` non basta.
drop function if exists vocabolari_chiusi();

create or replace function vocabolari_chiusi()
returns table (tabella text, colonna text, fonte text, valori text[], predefinito text)
language sql
stable
set search_path = public
as $$
  -- (a) I tipi `enum`, presi dalla colonna che li usa — anche quando la
  --     colonna e' un ARRAY di quel tipo (gli allergeni di una ricetta).
  select c.relname::text, a.attname::text, 'enum'::text,
         array_agg(e.enumlabel::text order by e.enumsortorder),
         max(pg_get_expr(d.adbin, d.adrelid))
    from pg_attribute a
    join pg_class     c on c.oid = a.attrelid and c.relkind = 'r'
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_type      t on t.oid = a.atttypid
    join pg_type      b on b.oid = coalesce(nullif(t.typelem, 0), t.oid)
    join pg_enum      e on e.enumtypid = b.oid
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where a.attnum > 0 and not a.attisdropped
   group by c.relname, a.attname

  union all

  -- (b) I vincoli `check` della forma «colonna = any (array[...])», su UNA
  --     colonna sola. ⚠️ Il filtro su una colonna sola non e' pigrizia:
  --     un vincolo composito (la sagoma di un tavolo) mescola vocabolari e
  --     misure, e spacciarlo per un vocabolario riempirebbe la rete di
  --     falsi allarmi — che e' il modo in cui una rete viene spenta.
  select c.relname::text, a.attname::text, 'vincolo'::text,
         (select array_agg(v order by v)
            from unnest(string_to_array(
                   regexp_replace(
                     (regexp_match(pg_get_constraintdef(k.oid), 'ARRAY\[([^\]]*)\]'))[1],
                     '[''\s]|::text', '', 'g'),
                   ',')) as v),
         pg_get_expr(d.adbin, d.adrelid)
    from pg_constraint k
    join pg_class     c on c.oid = k.conrelid
    join pg_namespace n on n.oid = k.connamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where k.contype = 'c'
     and array_length(k.conkey, 1) = 1
     and pg_get_constraintdef(k.oid) like '%= ANY (ARRAY[%';
$$;

comment on function vocabolari_chiusi() is
  'Ogni elenco chiuso di valori che il database impone: i tipi enum e i vincoli check su una colonna sola. Si costruisce dai cataloghi, non da un elenco scritto a mano — un vocabolario nuovo compare qui da solo.';

-- =====================================================================
-- 2. Quali funzioni ridicono un vocabolario
-- =====================================================================
--
-- Sono le guardie che esistono per dare un messaggio leggibile («Metodo di
-- pagamento non valido: …») invece di un errore di vincolo. Utili, e sono
-- il secondo posto che puo' divergere.
--
-- ⚠️ Si guardano SOLO gli elenchi confrontati con un PARAMETRO (`p_…`), e la
-- ragione e' che distinguere una guardia da un filtro e' tutto: `status in
-- ('chiuso','omaggiato')` dentro una query e' un filtro — un sottoinsieme
-- voluto — e trattarlo come una guardia darebbe una decina di allarmi falsi
-- permanenti.
create or replace function guardie_vocabolario()
returns table (funzione text, parametro text, valori text[])
language sql
stable
set search_path = public
as $$
  with corpi as (
    select p.proname::text as nome, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  ),
  trovate as (
    select nome,
           (regexp_matches(def, '(p_[a-z_0-9]+)\s+(?:not\s+)?in\s*\(\s*(''[^)]*'')\s*\)', 'gi')) as parti
      from corpi
  )
  select nome, parti[1],
         (select array_agg(v order by v)
            from unnest(string_to_array(regexp_replace(parti[2], '[''\s]', '', 'g'), ',')) as v)
    from trovate;
$$;

comment on function guardie_vocabolario() is
  'Le funzioni che ridicono un elenco chiuso per dare un messaggio leggibile. Solo i confronti con un parametro (p_…): un elenco usato come filtro dentro una query e'' un sottoinsieme voluto, e trattarlo come guardia darebbe allarmi falsi permanenti.';

revoke all on function vocabolari_chiusi()   from public, anon, authenticated;
revoke all on function guardie_vocabolario() from public, anon, authenticated;
grant execute on function vocabolari_chiusi()   to authenticated;
grant execute on function guardie_vocabolario() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
--
-- ⚠️ Qui si verifica solo che i due elenchi DICANO QUALCOSA e lo dicano
-- bene: il confronto vero, con le sue eccezioni dichiarate, sta nella prova
-- dal client. Il motivo e' quello del 16/08: le eccezioni di una rete
-- crescono e si correggono, e chiuse dentro una migrazione gia' applicata
-- non si potrebbero piu' toccare.
do $verifica$
declare
  n_voc   integer;
  n_guard integer;
  v_val   text[];
  n       integer;
begin
  select count(*) into n_voc   from vocabolari_chiusi();
  select count(*) into n_guard from guardie_vocabolario();

  -- Numeri di comodo? No: soglie MINIME che dicono «l'elenco non e' vuoto
  -- e non e' quasi vuoto». Un elenco che si costruisce da solo e torna
  -- vuoto per un errore di lettura dei cataloghi passerebbe inosservato, e
  -- la rete sarebbe accesa e cieca.
  if n_voc < 40 then
    raise exception 'vocabolari_chiusi() ne trova solo %: l''interrogazione dei cataloghi non funziona.', n_voc;
  end if;
  if n_guard < 5 then
    raise exception 'guardie_vocabolario() ne trova solo %: l''estrazione dai corpi non funziona.', n_guard;
  end if;

  -- Un caso noto e verificabile a mano, dei due tipi: un enum e un vincolo.
  -- Se l'estrazione dei valori si rompesse, questi due lo direbbero subito.
  select v.valori into v_val from vocabolari_chiusi() v
   where v.tabella = 'supplier_invoices' and v.colonna = 'payment_method';
  if v_val is null or not (v_val @> array['contante','bonifico','carta','assegno']
                           and array_length(v_val, 1) = 4) then
    raise exception 'Il vincolo dei metodi di pagamento non viene letto bene: %', v_val;
  end if;

  select v.valori into v_val from vocabolari_chiusi() v
   where v.tabella = 'orders' and v.colonna = 'status';
  if v_val is null or not v_val @> array['aperto','chiuso','annullato','omaggiato'] then
    raise exception 'L''enum degli stati di un conto non viene letto bene: %', v_val;
  end if;

  -- E la guardia di `pay_supplier_invoice`, che e' il caso che ha morso
  -- ieri: deve comparire, con tutti e quattro i valori.
  select g.valori into v_val from guardie_vocabolario() g
   where g.funzione = 'pay_supplier_invoice';
  if v_val is null or array_length(v_val, 1) <> 4 then
    raise exception 'La guardia di pay_supplier_invoice non viene letta: %', v_val;
  end if;

  -- ⚠️ E il controllo che vale piu' degli altri, perche' e' la trappola
  -- stessa: OGNI guardia deve dire esattamente quello che dice un
  -- vocabolario del database. Le eccezioni legittime — un parametro che
  -- accetta di proposito un sottoinsieme — stanno dichiarate nella prova
  -- dal client; qui si controlla che le eccezioni non siano di piu' di
  -- quelle, cioe' che nessuno abbia allargato una funzione lasciando
  -- indietro il suo vincolo.
  select count(*) into n
    from guardie_vocabolario() g
   where not exists (select 1 from vocabolari_chiusi() v where v.valori = g.valori);
  if n > 2 then
    raise exception
      'Ci sono % guardie che non combaciano con nessun vocabolario del database: una funzione e'' stata allargata senza il suo vincolo. Le eccezioni dichiarate sono 2.',
      n;
  end if;

  -- E l'altra faccia, misurata invece che sospettata: quanti di questi
  -- vocabolari stanno su una colonna con un valore PREDEFINITO, cioe' in
  -- quanti posti dimenticare il campo sbaglia **in silenzio** invece di
  -- dare errore. E' la superficie su cui si e' perso il `mezzo` delle mance
  -- il 16/08, e il giro dopo la camminera'.
  select count(*) into n from vocabolari_chiusi() v where v.predefinito is not null;

  raise notice 'Vocabolari chiusi nel database: %. Funzioni che ne ridicono uno: %. Guardie senza vocabolario combaciante: 2 (le dichiarate). Vocabolari su colonna con predefinito, dove una dimenticanza e'' silenziosa: %.',
    n_voc, n_guard, n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260817000003', 'i_vocabolari_si_contano')
on conflict (version) do nothing;

select
  (select count(*) from vocabolari_chiusi())   as vocabolari,
  (select count(*) from guardie_vocabolario()) as guardie,
  (select count(*) from vocabolari_chiusi() v where v.predefinito is not null)
    as dove_una_dimenticanza_e_silenziosa;
