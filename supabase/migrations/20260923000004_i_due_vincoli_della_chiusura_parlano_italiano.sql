-- =====================================================================
-- I DUE VINCOLI DELLA CHIUSURA PARLANO ITALIANO — C5, 23/09/2026
-- =====================================================================
--
-- 🔴 TROVATO DA UNA RETE CHE ESISTEVA GIA', non da una rilettura.
-- Applicata C5 sul progetto di prova, `tests/app/vincoli-che-parlano.test.js`
-- e' diventata rossa da sola e ha nominato i due colpevoli: l'unicita' su
-- societa' + anno e la chiave esterna verso il soggetto, nate mute con la
-- tabella `chiusure_annuali`.
--
-- ⚠️ ERA UN BUCO MIO, E DI UNA FORMA PRECISA: nella `20260923000003` avevo
-- scritto la frase italiana per i quattro vincoli `check` — quelli che
-- limitano un valore — e **non** per le altre due forme. La regola del
-- 25/08 riguardava i `check`, ed e' stata **allargata il 28/08** a unicita'
-- e chiavi esterne. *Correggere un esemplare non chiude la famiglia: il
-- controllo le guarda tutte e tre, e io ne avevo guardata una.*
--
-- ⚠️ E NON E' UN DIFETTO TEORICO. Sulla strada normale il messaggio buono
-- c'e' gia' — lo scrive `chiudi_anno`, che rifiuta un duplicato con la sua
-- frase. Ma la RLS permette al titolare di scrivere **dritto in tabella**,
-- e da li' il rifiuto arriverebbe come «duplicate key value violates unique
-- constraint», che in sala non e' un rifiuto: e' un guasto.
--
-- ⚠️ NON SI RISCRIVE LA `20260923000003` (regola del 23/08): e' gia'
-- applicata sul progetto di prova, e racconta cosa e' successo quel giorno.
-- Si ripara in avanti.
--
-- ---------------------------------------------------------------------
-- 🔴 IL LIMITE DI UN COMMENTO, DICHIARATO
-- ---------------------------------------------------------------------
-- Un `comment on constraint` **documenta** il vincolo: non cambia da se'
-- la lingua dell'errore che Postgres solleva. La traduzione la fa il punto
-- unico da cui passano le richieste dell'app (`src/lib/supabase.js`), che
-- legge proprio questo commento e lo mette al posto del messaggio inglese.
-- Quindi questa migrazione **riempie il posto da cui la traduzione pesca**,
-- e non introduce nessun trigger e nessuna logica nuova per riscrivere il
-- messaggio: sarebbe un lavoro diverso, e non e' questo.
--
-- ---------------------------------------------------------------------
-- I NOMI SE LI FA DIRE DAL CATALOGO
-- ---------------------------------------------------------------------
-- ⚠️ I due vincoli non li ha battezzati nessuno: il nome se l'e' scelto
-- Postgres. Scriverlo a mano qui vorrebbe dire **fidarsi di una regola di
-- costruzione** invece di guardare — e un nome sbagliato non darebbe
-- errore, darebbe un `comment on constraint` che fallisce oppure, peggio,
-- una migrazione che passa lasciando il vincolo muto.
--
-- Quindi si cercano per **struttura**, e si pretende di trovarne
-- esattamente uno per forma:
--   · l'unicita' su ESATTAMENTE (entity_id, anno) — ne' una colonna in
--     piu', ne' una in meno;
--   · la chiave esterna da entity_id verso entities(id), con la stessa
--     regola di cancellazione che ha oggi (`restrict`).
-- Se una delle due non c'e', o non e' com'era, la migrazione **si ferma
-- rumorosamente** invece di commentare la cosa sbagliata.
--
-- Idempotente (§7 punto 3). Si auto-registra in fondo (§7 punto 4).
-- =====================================================================

do $commenti$
declare
  v_unico  text;
  v_legame text;
  v_cols   text;
  v_del    char;
begin
  -- -------------------------------------------------------------------
  -- 1. L'UNICITA' SU SOCIETA' + ANNO
  -- -------------------------------------------------------------------
  -- ⚠️ Si confrontano le colonne per NOME e in ordine: `conkey` porta i
  --    numeri d'ordine delle colonne, che dicono poco a chi legge e
  --    cambiano se la tabella viene ricostruita.
  select c.conname,
         (select string_agg(a.attname, ',' order by k.ord)
            from unnest(c.conkey) with ordinality as k(attnum, ord)
            join pg_attribute a
              on a.attrelid = c.conrelid and a.attnum = k.attnum)
    into v_unico, v_cols
    from pg_constraint c
   where c.conrelid = 'chiusure_annuali'::regclass
     and c.contype = 'u';

  if v_unico is null then
    raise exception 'Su chiusure_annuali non c''e'' nessuna unicita'': la regola «un anno si chiude una volta sola» non esiste piu''. Mi fermo invece di commentare qualcos''altro.';
  end if;
  if v_cols is distinct from 'entity_id,anno' then
    raise exception 'L''unicita'' di chiusure_annuali non e'' su (entity_id, anno) ma su (%): non e'' il vincolo che questa migrazione doveva spiegare.', v_cols;
  end if;
  if (select count(*) from pg_constraint
       where conrelid = 'chiusure_annuali'::regclass and contype = 'u') <> 1 then
    raise exception 'Su chiusure_annuali c''e'' piu'' di un''unicita'': non so quale spiegare.';
  end if;

  -- -------------------------------------------------------------------
  -- 2. IL LEGAME CON IL SOGGETTO
  -- -------------------------------------------------------------------
  select c.conname, c.confdeltype
    into v_legame, v_del
    from pg_constraint c
   where c.conrelid = 'chiusure_annuali'::regclass
     and c.contype = 'f'
     and c.confrelid = 'entities'::regclass
     and (select string_agg(a.attname, ',' order by k.ord)
            from unnest(c.conkey) with ordinality as k(attnum, ord)
            join pg_attribute a
              on a.attrelid = c.conrelid and a.attnum = k.attnum) = 'entity_id';

  if v_legame is null then
    raise exception 'Su chiusure_annuali non c''e'' nessun legame da entity_id verso entities: mi fermo invece di commentare qualcos''altro.';
  end if;
  -- ⚠️ `r` = restrict, ed e' la regola che C5 ha scritto. Se fosse
  --    cambiata, la frase qui sotto racconterebbe una cosa non piu' vera.
  if v_del <> 'r' then
    raise exception 'Il legame % verso entities non e'' piu'' «restrict» ma «%»: la spiegazione che sto per scrivere sarebbe falsa.', v_legame, v_del;
  end if;

  -- -------------------------------------------------------------------
  -- 3. LE DUE FRASI
  -- -------------------------------------------------------------------
  -- ⚠️ `format` con %I e %L: il nome viene dal catalogo, e comporre una
  --    istruzione concatenando testo e' il modo in cui un nome strano
  --    diventa un errore di sintassi.
  execute format(
    'comment on constraint %I on chiusure_annuali is %L',
    v_unico,
    'Questo anno e'' gia'' stato chiuso per questa societa''. Un anno si fotografa una volta sola: se la fotografia e'' sbagliata si cancella e si richiude, e quella nuova dichiarera'' di essere una seconda.'
  );

  execute format(
    'comment on constraint %I on chiusure_annuali is %L',
    v_legame,
    'Questa chiusura e'' intestata a una societa'' che non esiste. Ogni anno si chiude per un soggetto — Borgo 58 o l''azienda agricola — e i due restano separati: nessun totale e nessuno storico li mescola.'
  );

  raise notice 'Spiegati in italiano: % (unicita'' su %) e % (legame verso entities, restrict).',
    v_unico, v_cols, v_legame;
end
$commenti$;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_tit  uuid;
  v_mute text;
  v_n    integer;
begin
  -- ⚠️ `vincoli_senza_frase()` ha un portiere, e dentro una migrazione non
  --    c'e' nessun utente: si impersona il titolare come fanno le altre
  --    verifiche, e si rimette a posto in fondo.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Manca il titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) I DUE DELLA CHIUSURA ANNUALE HANNO LA LORO FRASE.
  select string_agg(c.conname, ', ' order by c.conname) into v_mute
    from pg_constraint c
   where c.conrelid = 'chiusure_annuali'::regclass
     and c.contype in ('u', 'f')
     and obj_description(c.oid, 'pg_constraint') is null;
  if v_mute is not null then
    raise exception 'Questi vincoli della chiusura annuale sono ancora muti: %.', v_mute;
  end if;

  -- (2) E LA PROPRIETA' GENERALE: nessun vincolo muto fuori dall'elenco
  --     congelato. E' la stessa domanda che fa la prova, chiesta qui — se
  --     domani ne nascesse un altro, questa migrazione riapplicata lo
  --     direbbe.
  select count(*) into v_n from vincoli_senza_frase();
  if v_n > 0 then
    raise exception 'Ci sono % vincoli senza spiegazione in italiano: %.', v_n,
      (select string_agg(conname, ', ') from vincoli_senza_frase());
  end if;

  -- (3) ⚠️ E I QUATTRO `check` DI C5 NON SI SONO PERSI PER STRADA: questa
  --     migrazione aggiunge, non riscrive, e se avesse toccato la tabella
  --     se ne accorgerebbe qui.
  select count(*) into v_n
    from pg_constraint
   where conrelid = 'chiusure_annuali'::regclass and contype = 'c';
  if v_n < 4 then
    raise exception 'I vincoli check di chiusure_annuali sono %, erano 4: questa migrazione ne ha persi.', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei due vincoli della chiusura');
  raise notice 'Fatto: i due vincoli della chiusura annuale hanno la loro spiegazione. Vincoli muti fuori elenco: 0.';
end
$verifica$;

-- La migrazione si registra da sé
insert into applied_migrations (version, name)
values ('20260923000004', 'i_due_vincoli_della_chiusura_parlano_italiano')
on conflict (version) do nothing;
