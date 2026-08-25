-- ============================================================================
-- OGNI ALLERGENE DICE DA DOVE VIENE — 25/08/2026
-- ============================================================================
--
-- ✅ DECISIONE DI ALESSIO: gli allergeni si compilano da soli, senza
--    conferma voce per voce — nel 99% dei casi o sono scritti in etichetta
--    o sono ovvi. Quello che il gestionale deve fare e' DISTINGUERE
--    L'ORIGINE di ognuno, perche' quando un cliente chiede espressamente,
--    chi e' in sala deve vedere la differenza: su un allergene dedotto si
--    risponde mostrando gli ingredienti, non garantendo.
--
-- 🔴 LE ORIGINI SONO QUATTRO, NON TRE, e la quarta e' la piu' forte.
--    Il mandato ne nomina tre — letto in etichetta, ricavato da una fonte
--    consultata, dedotto. Manca il caso che in questo gestionale e' il
--    piu' comune di tutti: **l'ha messo Alessio**. E' anche il punto (d)
--    dello stesso mandato — «ogni campo ricorda chi l'ha messo, e se
--    Alessio corregge un campo compilato dall'assistente la marcatura
--    passa a lui» — applicato agli allergeni. Senza quel quarto valore, un
--    allergene scritto da una persona sarebbe indistinguibile da uno
--    dedotto da una macchina, che e' precisamente la confusione che questa
--    migrazione esiste per togliere.
--
-- ⚠️ UNA FONTE VA NOMINATA, e non e' una formalita': «ricavato da una
--    fonte» senza dire quale non e' piu' forte di «dedotto» — e a schermo
--    somiglierebbe a una garanzia. Il vincolo lo pretende nel database, non
--    nella schermata.
--
-- ⚠️ NON ESISTE UN ELENCO UFFICIALE INGREDIENTE→ALLERGENI, e va scritto
--    perche' qualcuno lo cerchera'. L'Allegato II del Regolamento UE
--    1169/2011 elenca i quattordici allergeni **da dichiarare**, non quali
--    prodotti li contengono. Una fonte che dica «la farina di grano
--    contiene glutine» e' un testo di cucina o una scheda tecnica, non una
--    norma: per questo la fonte si nomina invece di essere data per buona.
--
-- ⚠️ LE TRACCE DA CONTAMINAZIONE RESTANO FUORI. Ci sono gia' — la colonna
--    `allergeni_tracce`, con sopra scritto che non si stimano mai — e non
--    sono responsabilita' di Alessio quando non sono dichiarate in
--    etichetta: si coprono con la dicitura generale sul menu. Qui non
--    nasce nessun campo nuovo per quelle.
--
-- ----------------------------------------------------------------------------
-- COME QUESTA TABELLA STA IN PIEDI ACCANTO A `ingredients.allergens`
-- ----------------------------------------------------------------------------
-- ⚠️ E' LA DOMANDA CHE IL PROGETTO SI FA DAL 17/08: i due posti direbbero
--    *esattamente* la stessa cosa? **No.** `allergens` dice QUALI
--    allergeni ha il prodotto — ed e' quella che leggono il menu, la
--    scheda ricetta e la sala. `allergeni_prodotto` dice DA DOVE viene
--    ciascuno. Non si possono fondere, quindi serve una regola che le
--    tenga d'accordo.
--
--    La regola e' in una direzione sola, ed e' quella che non puo'
--    mentire: **quando un allergene sparisce da `allergens`, la sua riga
--    di origine sparisce con lui**. Il verso opposto non si automatizza:
--    un allergene presente in `allergens` senza riga di origine si legge
--    «lo ha messo Alessio», ed e' vero per costruzione, perche' tutte le
--    strade automatiche la riga la scrivono.
--
--    ⚠️ La proprieta' verificabile che ne esce e' netta: **nessuna riga di
--    origine per un allergene che il prodotto non ha piu'**. Un'origine
--    orfana e' peggio di un'origine mancante: afferma qualcosa su un
--    allergene che non c'e'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Da dove viene ciascun allergene
-- ----------------------------------------------------------------------------
create table if not exists allergeni_prodotto (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  allergene     allergen not null,
  origine       text not null,
  fonte         text,
  creato_il     timestamptz not null default now(),
  creato_da     uuid references auth.users(id) on delete set null,
  primary key (ingredient_id, allergene)
);

comment on table allergeni_prodotto is
  'Da dove viene ciascun allergene di un prodotto. Serve in sala: quando un cliente chiede espressamente, su un allergene dedotto si mostrano gli ingredienti e non si garantisce. Un allergene presente sul prodotto ma assente da qui l''ha messo Alessio a mano.';
comment on column allergeni_prodotto.origine is
  '`etichetta` = letto nella foto dell''etichetta, ed e'' la fonte legale. `fonte` = ricavato da una fonte consultata, che va nominata. `dedotto` = l''assistente l''ha ricavato dal nome del prodotto. `alessio` = l''ha scritto lui, e vince su tutto.';
comment on column allergeni_prodotto.fonte is
  'Quale fonte, in poche parole. Obbligatoria quando l''origine e'' `fonte`: «ricavato da una fonte» senza dire quale non vale piu'' di una deduzione, e a schermo somiglierebbe a una garanzia.';

alter table allergeni_prodotto drop constraint if exists origine_allergene_nota;
alter table allergeni_prodotto
  add constraint origine_allergene_nota
  check (origine in ('etichetta','fonte','dedotto','alessio'));
comment on constraint origine_allergene_nota on allergeni_prodotto is
  'Un allergene puo'' venire dall''etichetta, da una fonte consultata, da una deduzione dell''assistente, oppure da Alessio. Non c''e'' un quinto modo, e inventarne uno renderebbe muta la frase che la sala legge.';

alter table allergeni_prodotto drop constraint if exists la_fonte_si_nomina;
alter table allergeni_prodotto
  add constraint la_fonte_si_nomina
  check (origine <> 'fonte' or (fonte is not null and length(btrim(fonte)) > 0));
comment on constraint la_fonte_si_nomina on allergeni_prodotto is
  'Se un allergene viene da una fonte consultata, la fonte va nominata: senza il nome non e'' piu'' attendibile di una deduzione, ma in sala verrebbe letta come se lo fosse.';

create index if not exists idx_allergeni_prodotto_ing on allergeni_prodotto (ingredient_id);

alter table allergeni_prodotto enable row level security;

-- ⚠️ LA SALA DEVE POTERLI LEGGERE, ed e' il punto di tutta la migrazione:
--    serve al cameriere davanti al cliente che chiede. Si legge e basta —
--    scrivere resta del titolare.
drop policy if exists allergeni_prodotto_lettura on allergeni_prodotto;
create policy allergeni_prodotto_lettura on allergeni_prodotto
  for select to authenticated using (true);

drop policy if exists allergeni_prodotto_scrittura on allergeni_prodotto;
create policy allergeni_prodotto_scrittura on allergeni_prodotto
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 2. Un'origine non sopravvive al suo allergene
-- ----------------------------------------------------------------------------
create or replace function pulisci_origini_allergeni()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $funzione$
begin
  -- ⚠️ SOLO IN QUESTA DIREZIONE. Togliere una riga rimasta senza il suo
  --    allergene e' sempre giusto; aggiungerne una per un allergene
  --    comparso dal nulla vorrebbe dire indovinare da dove viene, ed e'
  --    esattamente cio' che questa tabella esiste per non fare.
  delete from allergeni_prodotto a
   where a.ingredient_id = new.id
     and not (a.allergene = any (coalesce(new.allergens, '{}'::allergen[])));
  return new;
end $funzione$;

revoke all on function pulisci_origini_allergeni() from public, anon, authenticated;

drop trigger if exists trg_pulisci_origini_allergeni on ingredients;
create trigger trg_pulisci_origini_allergeni
  after update of allergens on ingredients
  for each row execute function pulisci_origini_allergeni();

-- ----------------------------------------------------------------------------
-- 3. `origine_allergeni` diventa un RIFLESSO — ma solo quando c'e' cosa riflettere
-- ----------------------------------------------------------------------------
-- ⚠️ E' il quarto riflesso di questo progetto, dopo il mezzo di pagamento
--    di un conto, il conto aperto di un tavolo e «in carta» di una
--    ricetta. Vale la stessa regola: **lo scrive solo un trigger, mai
--    l'applicazione**, e la definizione vive in una funzione sola.
--
-- ⚠️ IL PIU' DEBOLE COMANDA, e non e' pessimismo: `origine_allergeni` e'
--    il valore che decide se l'elenco si puo' stampare sul menu. Se anche
--    un solo allergene e' dedotto, l'elenco non e' una dichiarazione — e
--    stamparlo lo farebbe diventare una promessa.
--    ⚠️ Anche `fonte` tiene l'elenco fuori dalla stampa: una fonte
--    consultata e' meglio di una deduzione, ma non e' l'etichetta del
--    prodotto, che e' la sola cosa che risponde di quel barattolo.
create or replace function origine_dell_insieme(p_ingredient_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $funzione$
  select case
    when count(*) = 0                                          then null
    when count(*) filter (where origine in ('dedotto','fonte')) > 0 then 'stimati'
    when count(*) filter (where origine = 'etichetta') > 0      then 'etichetta'
    else 'confermati'
  end
  from allergeni_prodotto where ingredient_id = p_ingredient_id;
$funzione$;

revoke all on function origine_dell_insieme(uuid) from public, anon, authenticated;
grant execute on function origine_dell_insieme(uuid) to authenticated;

create or replace function rispecchia_origine_allergeni()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_ing uuid := coalesce(new.ingredient_id, old.ingredient_id);
  v_val text;
begin
  v_val := origine_dell_insieme(v_ing);

  -- ⚠️ Quando non resta nessuna riga il riflesso NON si azzera: si lascia
  --    com'era. Svuotarlo direbbe «nessuno ci ha mai messo mano» di un
  --    prodotto su cui qualcuno ci ha messo mano eccome, e farebbe
  --    ripartire la stima automatica su allergeni gia'' guardati.
  if v_val is not null then
    update ingredients set origine_allergeni = v_val where id = v_ing;
  end if;

  return null;
end $funzione$;

revoke all on function rispecchia_origine_allergeni() from public, anon, authenticated;

drop trigger if exists trg_rispecchia_origine_allergeni on allergeni_prodotto;
create trigger trg_rispecchia_origine_allergeni
  after insert or update or delete on allergeni_prodotto
  for each row execute function rispecchia_origine_allergeni();

-- ----------------------------------------------------------------------------
-- 4. Quello che la sala legge
-- ----------------------------------------------------------------------------
-- ⚠️ RESTITUISCE ANCHE GLI ALLERGENI SENZA RIGA DI ORIGINE, marcati
--    `alessio`. Se restituisse solo le righe della tabella, un allergene
--    aggiunto a mano SPARIREBBE dall'elenco della sala — cioe' il
--    gestionale direbbe che un piatto non contiene una cosa che contiene.
--    E' la forma peggiore in cui questa funzione potrebbe sbagliare.
create or replace function allergeni_con_origine(p_ingredient_id uuid)
returns table(allergene text, origine text, fonte text, frase text)
language sql
stable
security definer
set search_path to 'public'
as $funzione$
  select
    a.allergene::text,
    coalesce(o.origine, 'alessio'),
    o.fonte,
    case coalesce(o.origine, 'alessio')
      when 'etichetta' then 'Scritto sull''etichetta del prodotto.'
      when 'alessio'   then 'Verificato da Alessio.'
      when 'fonte'     then 'Ricavato da: ' || coalesce(o.fonte, '(fonte non indicata)') || '. Non e'' scritto sull''etichetta.'
      else                  'Dedotto dal tipo di prodotto: nessuno l''ha letto sull''etichetta. Se il cliente chiede, mostragli gli ingredienti invece di garantire.'
    end
  from ingredients i
  cross join lateral unnest(i.allergens) as a(allergene)
  left join allergeni_prodotto o
    on o.ingredient_id = i.id and o.allergene = a.allergene
  where i.id = p_ingredient_id
  order by 1;
$funzione$;

revoke all on function allergeni_con_origine(uuid) from public, anon, authenticated;
grant execute on function allergeni_con_origine(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Applicare quello che l'assistente ha letto sull'etichetta
-- ----------------------------------------------------------------------------
-- ⚠️ L'ETICHETTA SOVRASCRIVE UNA STIMA, MA NON UNA CONFERMA DI ALESSIO.
--    Un'etichetta letta batte una deduzione — e' la fonte legale. Ma se
--    Alessio ha guardato quel prodotto con i suoi occhi, ha guardato: il
--    gestionale glielo DICE invece di scavalcarlo in silenzio.
create or replace function applica_lettura_etichetta(
  p_ingredient_id uuid,
  p_campi         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_ing       ingredients%rowtype;
  v_allergeni allergen[] := '{}';
  v_scartati  text[] := '{}';
  v_scritti   text[] := '{}';
  v_voce      jsonb;
  v_codice    text;
  v_origine   text;
  v_a         allergen;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' applicare la lettura di un''etichetta.';
  end if;

  select * into v_ing from ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Questo prodotto non esiste piu''.';
  end if;

  if v_ing.origine_allergeni = 'confermati' then
    -- Un rifiuto senza via d'uscita e' un vicolo cieco: si dice cosa fare.
    return jsonb_build_object(
      'id', p_ingredient_id,
      'scritti', to_jsonb('{}'::text[]),
      'scartati', to_jsonb(array['allergeni: li hai gia'' verificati tu, e una lettura automatica non li scavalca. Per cambiarli, correggili a mano nella scheda.']),
      'allergeni_toccati', 0);
  end if;

  -- ------------------------------------------------------------------
  -- Gli allergeni, con la loro origine uno per uno
  -- ------------------------------------------------------------------
  if p_campi ? 'allergeni' then
    for v_voce in select jsonb_array_elements(p_campi->'allergeni')
    loop
      v_codice  := v_voce->>'codice';
      v_origine := coalesce(v_voce->>'origine', 'dedotto');

      -- ⚠️ Un codice che non esiste si SCARTA e si dichiara, invece di
      --    far fallire tutta la lettura: un allergene inventato dal
      --    modello non deve portarsi via gli altri tredici che ha preso.
      begin
        v_a := v_codice::allergen;
      exception when others then
        v_scartati := v_scartati || ('allergene sconosciuto: ' || coalesce(v_codice, '(vuoto)'));
        continue;
      end;

      if v_origine not in ('etichetta','fonte','dedotto') then
        v_scartati := v_scartati || ('origine sconosciuta per ' || v_codice || ': ' || v_origine);
        continue;
      end if;

      -- ⚠️ `fonte` senza il nome della fonte SCENDE a `dedotto`, non viene
      --    scartato: l'allergene c'e' comunque e toglierlo sarebbe la cosa
      --    pericolosa. Quello che si perde e' la pretesa di attendibilita'.
      if v_origine = 'fonte' and coalesce(btrim(v_voce->>'fonte'), '') = '' then
        v_origine := 'dedotto';
        v_scartati := v_scartati || ('fonte non indicata per ' || v_codice || ': vale come dedotto');
      end if;

      v_allergeni := v_allergeni || v_a;

      insert into allergeni_prodotto (ingredient_id, allergene, origine, fonte, creato_da)
      values (p_ingredient_id, v_a, v_origine, nullif(btrim(v_voce->>'fonte'), ''), auth.uid())
      on conflict (ingredient_id, allergene) do update
        set origine   = excluded.origine,
            fonte     = excluded.fonte,
            creato_il = now(),
            creato_da = excluded.creato_da
        -- Una lettura non declassa mai quello che Alessio ha scritto.
        where allergeni_prodotto.origine <> 'alessio';
    end loop;

    -- ⚠️ SI SCRIVE L'INSIEME LETTO, non l'unione con quello di prima.
    --    Un'etichetta e' una dichiarazione completa: se il glutine non c'e'
    --    piu', tenerlo perche' c'era prima vorrebbe dire non aver letto
    --    l'etichetta. Le righe di origine rimaste senza allergene se le
    --    porta via il trigger.
    update ingredients set allergens = v_allergeni where id = p_ingredient_id;
    v_scritti := v_scritti || 'allergeni'::text;
  end if;

  -- ------------------------------------------------------------------
  -- Gli altri campi: solo dove non c'e' gia' qualcosa
  -- ------------------------------------------------------------------
  if v_ing.storage_type is null and nullif(p_campi->>'conservazione', '') is not null then
    begin
      update ingredients set storage_type = (p_campi->>'conservazione')::storage_type
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'conservazione'::text;
    exception when others then
      v_scartati := v_scartati || ('conservazione: ' || (p_campi->>'conservazione'));
    end;
  end if;

  if v_ing.shelf_life_days is null and (p_campi->>'durata_giorni') is not null then
    update ingredients set shelf_life_days = greatest(1, (p_campi->>'durata_giorni')::integer)
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'durata'::text;
  end if;

  if v_ing.temperatura_attesa is null and nullif(p_campi->>'temperatura', '') is not null then
    update ingredients set temperatura_attesa = p_campi->>'temperatura'
     where id = p_ingredient_id;
    v_scritti := v_scritti || 'temperatura'::text;
  end if;

  -- ⚠️ Gli allergeni NON entrano fra i «campi da confermare»: ce l'hanno
  --    gia' una loro origine, con quattro stati invece di due. Metterli
  --    anche li' sarebbero due posti che dicono la stessa cosa — la stessa
  --    ragione per cui `applica_scheda_prodotto` li tiene fuori.
  update ingredients
     set campi_compilati_il = now(),
         campi_da_confermare = coalesce((
           select array_agg(distinct x order by x)
             from unnest(campi_da_confermare || v_scritti) x
            where x <> 'allergeni'
         ), '{}')
   where id = p_ingredient_id;

  return jsonb_build_object(
    'id', p_ingredient_id,
    'scritti', to_jsonb(v_scritti),
    'scartati', to_jsonb(v_scartati),
    'allergeni_toccati', coalesce(array_length(v_allergeni, 1), 0));
end $funzione$;

revoke all on function applica_lettura_etichetta(uuid, jsonb) from public, anon, authenticated;
grant execute on function applica_lettura_etichetta(uuid, jsonb) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba che la verifica ha creato: un prodotto
--    suo, mai uno di Alessio (lezione del 16/08 — riusare un ingrediente
--    vero ha gia' lasciato una giacenza corta senza spiegazione).
do $verifica$
declare
  v_tit    uuid;
  v_ent    uuid;
  v_mio    uuid;
  v_esito  jsonb;
  v_r      record;
  v_n      integer;
  v_txt    text;
  v_ok     boolean;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Nessuna societa'': impossibile verificare.';
  end if;

  insert into ingredients (entity_id, name, category, unit, current_price)
  values (v_ent, 'ZZ verifica etichetta', 'secco_dispensa', 'kg', 1.00)
  returning id into v_mio;

  -- ------------------------------------------------------------------
  -- (A) Tre origini diverse nella stessa lettura, e la fonte si nomina.
  -- ------------------------------------------------------------------
  v_esito := applica_lettura_etichetta(v_mio, jsonb_build_object(
    'allergeni', jsonb_build_array(
      jsonb_build_object('codice','glutine','origine','etichetta'),
      jsonb_build_object('codice','latte',  'origine','fonte','fonte','scheda tecnica del produttore'),
      jsonb_build_object('codice','soia',   'origine','dedotto')),
    'conservazione', 'dispensa',
    'durata_giorni', 180,
    'temperatura', 'ambiente'));

  if (v_esito->>'allergeni_toccati')::int <> 3 then
    raise exception 'Gli allergeni scritti sono % invece di 3', v_esito->>'allergeni_toccati';
  end if;

  select count(*) into v_n from allergeni_prodotto where ingredient_id = v_mio;
  if v_n <> 3 then raise exception 'Le origini registrate sono % invece di 3', v_n; end if;

  select array_length(allergens, 1) into v_n from ingredients where id = v_mio;
  if v_n <> 3 then raise exception 'Il prodotto ha % allergeni invece di 3', v_n; end if;

  -- ------------------------------------------------------------------
  -- (B) La sala vede TRE frasi diverse — ed e' il punto del mandato.
  --     ⚠️ Se le tre origini producessero la stessa frase, in sala il
  --     «dedotto» si comporterebbe come una garanzia, che e'
  --     precisamente cio' che questa migrazione esiste per impedire.
  -- ------------------------------------------------------------------
  select count(distinct frase) into v_n from allergeni_con_origine(v_mio);
  if v_n <> 3 then
    raise exception 'Le tre origini danno % frasi diverse invece di 3', v_n;
  end if;

  select frase into v_txt from allergeni_con_origine(v_mio) where allergene = 'soia';
  if v_txt not like '%invece di garantire%' then
    raise exception 'Il dedotto non avverte la sala: «%»', v_txt;
  end if;

  select frase into v_txt from allergeni_con_origine(v_mio) where allergene = 'latte';
  if v_txt not like '%scheda tecnica del produttore%' then
    raise exception 'La fonte non viene nominata: «%»', v_txt;
  end if;

  -- ------------------------------------------------------------------
  -- (C) Il riflesso: con un dedotto dentro, l'insieme resta «stimati»
  --     e quindi NON si stampa sul menu.
  -- ------------------------------------------------------------------
  select origine_allergeni into v_txt from ingredients where id = v_mio;
  if v_txt <> 'stimati' then
    raise exception 'Con un allergene dedotto l''insieme risulta «%» invece di «stimati»', v_txt;
  end if;

  -- Tolto il dedotto e la fonte, resta solo l'etichetta: l'insieme sale.
  delete from allergeni_prodotto where ingredient_id = v_mio and allergene in ('soia','latte');
  update ingredients set allergens = array['glutine']::allergen[] where id = v_mio;
  select origine_allergeni into v_txt from ingredients where id = v_mio;
  if v_txt <> 'etichetta' then
    raise exception 'Con la sola etichetta l''insieme risulta «%» invece di «etichetta»', v_txt;
  end if;

  -- ------------------------------------------------------------------
  -- (D) Un'origine non sopravvive al suo allergene.
  --     ⚠️ Un'origine orfana afferma qualcosa su un allergene che il
  --     prodotto non ha: e' peggio di un'origine mancante.
  -- ------------------------------------------------------------------
  update ingredients set allergens = '{}'::allergen[] where id = v_mio;
  select count(*) into v_n from allergeni_prodotto where ingredient_id = v_mio;
  if v_n <> 0 then
    raise exception 'Sono rimaste % origini per allergeni che il prodotto non ha piu''', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- (E) Un allergene messo a mano NON sparisce dalla sala: si legge
  --     «verificato da Alessio». ⚠️ Se sparisse, il gestionale direbbe
  --     che un piatto non contiene una cosa che contiene.
  -- ------------------------------------------------------------------
  update ingredients set allergens = array['sedano']::allergen[] where id = v_mio;
  select count(*) into v_n from allergeni_con_origine(v_mio);
  if v_n <> 1 then
    raise exception 'Un allergene senza riga di origine sparisce dalla sala (ne vedo %)', v_n;
  end if;
  select origine into v_txt from allergeni_con_origine(v_mio) where allergene = 'sedano';
  if v_txt <> 'alessio' then
    raise exception 'Un allergene messo a mano risulta «%» invece che di Alessio', v_txt;
  end if;

  -- ------------------------------------------------------------------
  -- (F) Una fonte senza nome e' respinta dal database.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    insert into allergeni_prodotto (ingredient_id, allergene, origine, fonte)
    values (v_mio, 'sedano', 'fonte', '   ');
    raise exception 'ATTESO RIFIUTO: fonte senza nome accettata';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then raise exception 'Una fonte senza nome e'' passata'; end if;

  -- ------------------------------------------------------------------
  -- (G) Quello che Alessio ha confermato non si scavalca, E LO DICE.
  -- ------------------------------------------------------------------
  update ingredients set origine_allergeni = 'confermati' where id = v_mio;
  v_esito := applica_lettura_etichetta(v_mio, jsonb_build_object(
    'allergeni', jsonb_build_array(jsonb_build_object('codice','pesce','origine','etichetta'))));
  if (v_esito->>'allergeni_toccati')::int <> 0 then
    raise exception 'Una lettura ha scavalcato allergeni gia'' confermati da Alessio';
  end if;
  if v_esito->>'scartati' not like '%correggili a mano%' then
    raise exception 'Il rifiuto non dice cosa fare: %', v_esito->>'scartati';
  end if;

  -- ------------------------------------------------------------------
  -- (H) Un allergene inventato si scarta senza portarsi via gli altri.
  -- ------------------------------------------------------------------
  update ingredients set origine_allergeni = null where id = v_mio;
  v_esito := applica_lettura_etichetta(v_mio, jsonb_build_object(
    'allergeni', jsonb_build_array(
      jsonb_build_object('codice','zucchero','origine','etichetta'),
      jsonb_build_object('codice','uova',    'origine','etichetta'))));
  if (v_esito->>'allergeni_toccati')::int <> 1 then
    raise exception 'Un codice inventato si e'' portato via anche quello buono';
  end if;
  if v_esito->>'scartati' not like '%zucchero%' then
    raise exception 'Il codice inventato non e'' dichiarato: %', v_esito->>'scartati';
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, e la lapide non resta
  -- ------------------------------------------------------------------
  delete from allergeni_prodotto where ingredient_id = v_mio;
  delete from ingredients where id = v_mio;

  select count(*) into v_n from ingredients where id = v_mio;
  if v_n <> 0 then raise exception 'Il prodotto della verifica e'' rimasto'; end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Ogni allergene dice da dove viene: tre origini danno tre frasi diverse, un dedotto tiene l''elenco fuori dalla stampa, un''origine non sopravvive al suo allergene, e uno messo a mano non sparisce dalla sala.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000014', 'ogni_allergene_dice_da_dove_viene')
on conflict (version) do nothing;
