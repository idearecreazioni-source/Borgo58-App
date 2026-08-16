-- =====================================================================
-- Le tre lapidi di prova, e due regole che nascono da qui
-- =====================================================================
-- Coda del mandato di correzione (16/08/2026), su decisione di Alessio
-- dopo il rilievo del validatore.
--
-- 1. TRE RIGHE FINTE NEL REGISTRO DELLE CANCELLAZIONI. La verifica di
--    `20260816000003` (mance e vitto) ha creato e poi cancellato due
--    mance e una distribuzione: `deleted_records` le ha registrate, e li'
--    sono rimaste. Un registro delle cancellazioni con dentro roba finta
--    e' lo stesso problema di una riga finta in prima nota — solo piu'
--    difficile da notare, perche' nessuno lo guarda finche' non serve.
--
-- ⚠️ PERIMETRO STRETTO, come per il detergente: si toglie solo cio' che
-- porta la marca `__PROVA MANCE__`, che scrive unicamente la verifica
-- delle mance. **Il guardiano non e' il numero atteso** — vedi la nota
-- sopra il blocco: e' che le cancellazioni VERE di quelle tabelle siano
-- le stesse prima e dopo.
--
-- 2. OGNI SANATORIA DICHIARA QUANTE RIGHE HA TOCCATO (regola nuova). Il
--    Blocco 9 e' fallito due volte e in mezzo c'era un silenzio: sul
--    progetto di prova la sanatoria toccava zero righe e nessuno lo
--    diceva. Da qui in avanti il numero si stampa sempre — **e uno zero
--    sul progetto di prova va riportato nel riepilogo, alla voce «cosa
--    non e' verificato»**. Non blocca niente: toglie il silenzio, che e'
--    cio' che ha ingannato quattro volte.
--
-- 3. E LA REGOLA CHE HA CAUSATO QUEL FALLIMENTO, scritta qui perche' e'
--    la prima migrazione dopo: **dentro una migrazione non si chiamano le
--    funzioni dell'applicazione che hanno un portiere** (`is_titolare()`,
--    `auth.uid()`). Una migrazione non ha un utente: ha un proprietario.
--    Una sanatoria legge le tabelle; se la funzione serve davvero, si
--    impostano i claims come fanno i blocchi di verifica. A sorvegliarlo
--    e' `tests/app/migrazioni-senza-portieri.test.js`, che l'elenco delle
--    funzioni col portiere se lo costruisce dal database.
--
-- ⚠️ Questa migrazione non chiama nessuna funzione dell'app: legge
-- `deleted_records` e basta. E' il primo esempio della regola 3.
-- =====================================================================

-- ⚠️ IL GUARDIANO NON E' UN NUMERO FISSO, e la prima versione di questa
-- migrazione lo era: «se non sono esattamente tre, fermati». Si e'
-- fermata subito — **sul progetto di prova quelle righe sono 24**, perche'
-- la verifica delle mance si riesegue a ogni riapplicazione e ne lascia
-- tre ogni volta. Il numero atteso non e' una proprieta' del mondo: e' una
-- fotografia della produzione di stamattina.
--
-- Al suo posto c'e' il guardiano che dice la cosa vera: **il perimetro
-- non si allarga**. Prima e dopo, le righe di quelle due tabelle che NON
-- portano la marca devono essere le stesse — e se una cancellazione vera
-- ci fosse, resterebbe intatta. E' la stessa forma della lezione del
-- 14/08: il controllo finale guarda anche cio' che e' cambiato, non solo
-- cio' che e' rimasto.
do $pulizia$
declare
  n_vere_prima integer;
  n_vere_dopo  integer;
  n_tolte      integer;
begin
  select count(*) into n_vere_prima
    from deleted_records
   where table_name in ('tips_collected', 'tip_distributions')
     and coalesce(record->>'note', '') <> '__PROVA MANCE__';

  delete from deleted_records
   where table_name in ('tips_collected', 'tip_distributions')
     and record->>'note' = '__PROVA MANCE__';
  get diagnostics n_tolte = row_count;

  select count(*) into n_vere_dopo
    from deleted_records
   where table_name in ('tips_collected', 'tip_distributions')
     and coalesce(record->>'note', '') <> '__PROVA MANCE__';

  if n_vere_dopo <> n_vere_prima then
    raise exception
      'La pulizia ha toccato cancellazioni VERE: erano %, ora sono %.',
      n_vere_prima, n_vere_dopo;
  end if;

  -- ⚠️ Regola nuova di questa consegna: ogni sanatoria dichiara quante
  -- righe ha toccato. Uno zero non e' un errore — vuol dire gia' fatto, o
  -- niente da fare su questo database — ma va DETTO, e riportato nel
  -- riepilogo alla voce «cosa non e' verificato». E' il silenzio ad aver
  -- ingannato quattro volte, non la mancanza del dato.
  raise notice 'Sanatoria: % lapidi di prova tolte, % cancellazioni vere intatte.',
    n_tolte, n_vere_dopo;
end $pulizia$;

-- ---------------------------------------------------------------------
-- Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  n integer;
begin
  select count(*) into n
    from deleted_records
   where table_name in ('tips_collected', 'tip_distributions')
     and record->>'note' = '__PROVA MANCE__';
  if n <> 0 then
    raise exception 'Nel registro restano % lapidi di prova.', n;
  end if;

  -- ⚠️ E il registro non si e' svuotato oltre il perimetro: le
  -- cancellazioni vere di quelle due tabelle, se ce ne fossero, non
  -- c'entrano niente con la prova delle mance. Qui se ne contano zero
  -- perche' non ce n'e' nessuna, ed e' il controllo che dimostra che il
  -- `delete` non ha allargato la mano.
  select count(*) into n
    from deleted_records
   where table_name in ('tips_collected', 'tip_distributions');
  raise notice 'Restano % cancellazioni vere di mance nel registro.', n;
end $verifica$;

-- ---------------------------------------------------------------------
-- L'elenco che la prova sulle migrazioni interroga
-- ---------------------------------------------------------------------
-- ⚠️ Vive nel database e non nel file della prova, per la stessa ragione
-- dell'elenco delle multi-tabella: scritto a mano invecchierebbe in
-- silenzio, e chi aggiunge una funzione col portiere non ha nessun motivo
-- per ricordarsene. Cosi' la domanda si rifa' da sola a ogni esecuzione.
create or replace function funzioni_col_portiere()
returns table (nome text, portiere text)
language sql
stable
security definer
set search_path = public
as $funzione$
  select p.proname::text,
         case
           when pg_get_functiondef(p.oid) like '%is_titolare()%'
            and pg_get_functiondef(p.oid) like '%auth.uid()%' then 'is_titolare() e auth.uid()'
           when pg_get_functiondef(p.oid) like '%is_titolare()%' then 'is_titolare()'
           else 'auth.uid()'
         end
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     -- ⚠️ Il portiere si riconosce dalla FORMA, non dalla parola: questa
     -- funzione stessa nomina «is_titolare()» dentro un confronto, e con
     -- una ricerca per parola finirebbe nel proprio elenco. Si cerca il
     -- gesto — «se non sei il titolare, rifiuta» — non il nome.
     and (pg_get_functiondef(p.oid) ~ 'not\s+is_titolare\s*\(\s*\)'
       or pg_get_functiondef(p.oid) ~ 'auth\.uid\s*\(\s*\)\s+is\s+null')
   order by 1;
$funzione$;

comment on function funzioni_col_portiere() is
  'Le funzioni dell''applicazione che controllano CHI le chiama (16/08/2026). Una migrazione non ha un utente — ha un proprietario — quindi chiamarle da una sanatoria le fa rifiutare: e'' successo due volte col Blocco 9. Una sanatoria legge le tabelle; se la funzione serve davvero, si impostano i claims come fanno i blocchi di verifica. A sorvegliarlo e'' tests/app/migrazioni-senza-portieri.test.js, che l''elenco se lo costruisce da qui.';

revoke all on function funzioni_col_portiere() from public, anon, authenticated;
grant execute on function funzioni_col_portiere() to authenticated;

insert into applied_migrations (version, name)
values ('20260816000013', 'le_tre_lapidi_di_prova')
on conflict (version) do nothing;

select
  (select count(*) from deleted_records)                                     as righe_registro,
  (select count(*) from deleted_records
    where record->>'note' = '__PROVA MANCE__')                               as lapidi_di_prova;
