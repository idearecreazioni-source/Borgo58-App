-- =====================================================================
-- LA TASCA DI ALESSIO — 30/08/2026
-- =====================================================================
--
-- 🔴 DECISIONE SUA, con le sue parole dentro: tiene contanti propri e ci
-- compra roba per il progetto **senza fattura**, da prima che esistesse la
-- partita IVA. Non e' deducibile, e **lui non la dichiara**: vuole solo
-- saperne il conto.
--
-- 🔴 E' UN TERZO SOGGETTO, accanto a Borgo 58 e a Orto Borgo 58, con saldo
-- suo. ⚠️ **Non e' la stessa cosa delle anticipazioni del socio** (Blocco 7
-- del 15/08): quelle sono spese fatte **per conto della societa'**, che la
-- societa' poi pareggia. La tasca no — non c'e' niente da pareggiare, e
-- infatti **non registra nessuna entrata**.
--
-- ⚠️ SI RIUSA QUELLO CHE C'E', e non e' pigrizia: `cash_movements` porta gia'
-- `entity_id`, e **47 funzioni** del database filtrano gia' per soggetto
-- (misurato il 30/08 cercando `p_entity` nei corpi vivi). Un impianto
-- parallelo avrebbe rifatto la prima nota, i saldi, l'esportazione e le
-- causali — e ognuno di quei pezzi sarebbe potuto divergere dal suo gemello.
--
-- 🔴 LE TRE REGOLE STANNO NEL DATABASE, NON NELLA SCHERMATA, perche' una
-- regola nella schermata la aggira chiunque scriva da un'altra porta:
--   1. dalla tasca escono soldi e basta — **nessuna entrata**;
--   2. l'unica regola di deducibilita' ammessa e' **«Indeducibile»**;
--   3. la tasca **non puo' avere parametri fiscali**, quindi non puo' essere
--      proiettata. E' la forma «per costruzione» che Alessio ha chiesto
--      invece di un promemoria: non c'e' niente da ricordarsi di filtrare.
--
-- ⚠️ E LA REGOLA 2 HA DUE FACCE, che e' il punto piu' delicato:
--   · se nessuno la nomina, la scrive il trigger — e' sempre la stessa, e
--     chiederla sarebbe **offrire la possibilita' di sbagliarla** (la stessa
--     ragione per cui la causale del prestito e' uscita dalla firma il
--     29/08);
--   · se qualcuno ne nomina **un'altra**, si RIFIUTA. Sovrascriverla in
--     silenzio farebbe passare per accettata una scelta che il gestionale
--     ha buttato via — e in questo progetto il silenzio e' il difetto.

-- ---------------------------------------------------------------------
-- 1. IL TIPO DI SOGGETTO
-- ---------------------------------------------------------------------
-- ⚠️ L'`alter type` sta su una riga SUA, fuori da qualunque blocco: un
--    valore aggiunto a un enum non e' usabile nella stessa transazione che
--    lo aggiunge. Applicato da `psql`, dove ogni istruzione si chiude da
--    se', il blocco successivo lo trova gia' committato (regola del 19/08).
alter type entity_type add value if not exists 'tasca';

-- ---------------------------------------------------------------------
-- 2. IL SOGGETTO, E LA FUNZIONE CHE DECIDE CHI E' UNA TASCA
-- ---------------------------------------------------------------------
do $soggetto$
begin
  if not exists (select 1 from entities where entity_type = 'tasca') then
    insert into entities (entity_type, name, legal_name, vat_regime, is_active, notes)
    values ('tasca', 'La tasca di Alessio', null, 'non_definito', true,
            'Contanti suoi spesi per il progetto senza fattura. Non deducibile e non dichiarata: serve solo a saperne il conto. Registra solo uscite.');
  end if;
end $soggetto$;

comment on type entity_type is
  'I soggetti del gestionale. «tasca» non e'' una societa'': e'' il denaro personale di Alessio speso per il progetto senza documento — registra solo uscite, e'' sempre indeducibile e non entra in nessun calcolo fiscale.';

-- ⚠️ UNA FUNZIONE SOLA DECIDE CHI E' UNA TASCA. Se la condizione vivesse
--    dentro i tre trigger, il giorno che cambia ne cambierebbe uno solo.
create or replace function e_una_tasca(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from entities where id = p_entity_id and entity_type = 'tasca');
$fn$;

-- 🔴 LA PORTA SI CHIUDE E BASTA, e non le si mette un portiere.
--    Nasce aperta a chiunque abbia la chiave pubblica (trappola
--    dell'11/08), e la rete dei permessi l'ha nominata subito. Ma la cura
--    giusta e' la (a) della regola del 27/08 — *nessun utente la chiama,
--    quindi si chiude la porta e non serve nessun portiere*:
--    · la chiamano SOLO i tre trigger qui sotto, che sono `security
--      definer` e la eseguono coi permessi del proprietario;
--    · nessuna schermata la chiama;
--    · e un `is_titolare()` dentro sarebbe stato **la cura sbagliata**:
--      dentro un `security definer` l'identita' resta quella di chi
--      chiama, quindi un movimento di cassa scritto dalla sala sarebbe
--      stato rifiutato da un controllo che non c'entrava niente.
revoke all on function e_una_tasca(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. DALLA TASCA ESCONO SOLDI E BASTA, E SEMPRE INDEDUCIBILI
-- ---------------------------------------------------------------------
create or replace function guardia_movimenti_tasca()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_indeducibile uuid;
  v_etichetta    text;
begin
  if not e_una_tasca(new.entity_id) then
    return new;
  end if;

  -- (1) Nessuna entrata. Un'entrata in tasca sarebbe denaro che il progetto
  --     restituisce ad Alessio, cioe' un pareggio — la cosa che lui ha
  --     detto di non voler fare.
  if new.direction <> 'uscita' then
    raise exception 'Dalla tasca escono soldi e basta: e'' il contante che Alessio spende di suo per il progetto, e non c''e'' niente da fargli rientrare. Se stai registrando una spesa che la societa'' gli rimborsa, non e'' la tasca — sono le anticipazioni del socio, in Cassa.';
  end if;

  select id into v_indeducibile
    from regole_deducibilita
   where percentuale_deducibile = 0
   order by ordine
   limit 1;

  if v_indeducibile is null then
    raise exception 'Manca la regola di deducibilita'' allo zero per cento: senza, una spesa della tasca non si puo'' classificare.';
  end if;

  -- (2) La regola e' sempre la stessa. Se nessuno la nomina la scrive il
  --     trigger; se qualcuno ne nomina un'altra, si rifiuta invece di
  --     sovrascriverla in silenzio.
  if new.regola_deducibilita_id is null then
    new.regola_deducibilita_id := v_indeducibile;
  elsif new.regola_deducibilita_id <> v_indeducibile then
    select etichetta into v_etichetta
      from regole_deducibilita where id = new.regola_deducibilita_id;
    raise exception 'Una spesa della tasca puo'' essere solo «Indeducibile», e questa e'' segnata «%». Sono soldi personali spesi senza documento: non si deducono. Se invece la spesa ha una fattura intestata alla societa'', registrala su Borgo 58 e non sulla tasca.',
      coalesce(v_etichetta, 'un''altra regola');
  end if;

  return new;
end;
$fn$;

revoke all on function guardia_movimenti_tasca() from public, anon, authenticated;

drop trigger if exists trg_guardia_movimenti_tasca on cash_movements;
create trigger trg_guardia_movimenti_tasca
  before insert or update on cash_movements
  for each row execute function guardia_movimenti_tasca();

-- ---------------------------------------------------------------------
-- 4. FUORI DALLA PROIEZIONE FISCALE PER COSTRUZIONE
-- ---------------------------------------------------------------------
-- 🔴 Non un filtro da ricordarsi di scrivere in ogni schermata nuova: la
--    tasca **non puo' avere parametri fiscali**, e senza quelli il motore
--    unico si rifiuta gia' da se' di calcolare qualunque imposta. Cosi' la
--    separazione non e' una cosa che qualcuno deve ricordarsi di fare.
-- ⚠️ E lo stesso vale per una previsione: uno scenario intestato alla tasca
--    proietterebbe dei ricavi che non esistono.
create or replace function vieta_fiscale_sulla_tasca()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if e_una_tasca(new.entity_id) then
    raise exception 'La tasca non e'' una societa'' e non ha imposte: sono contanti personali spesi senza documento, e restano fuori da ogni calcolo fiscale. I parametri fiscali si mettono su Borgo 58 o sull''azienda agricola.';
  end if;
  return new;
end;
$fn$;

revoke all on function vieta_fiscale_sulla_tasca() from public, anon, authenticated;

drop trigger if exists trg_niente_fiscale_sulla_tasca on fiscal_settings;
create trigger trg_niente_fiscale_sulla_tasca
  before insert or update on fiscal_settings
  for each row execute function vieta_fiscale_sulla_tasca();

drop trigger if exists trg_niente_previsioni_sulla_tasca on scenari_proiezione;
create trigger trg_niente_previsioni_sulla_tasca
  before insert or update on scenari_proiezione
  for each row execute function vieta_fiscale_sulla_tasca();

-- ---------------------------------------------------------------------
-- 5. QUANTO E' USCITO DALLA TASCA
-- ---------------------------------------------------------------------
-- ⚠️ NON un «saldo»: dalla tasca escono soldi e basta, quindi un saldo
--    sarebbe sempre negativo e si leggerebbe come un debito. Quello che
--    Alessio ha chiesto e' **il conto**: quanto ha speso, e per cosa.
create or replace function speso_dalla_tasca(p_dal date default null, p_al date default null)
returns table (
  causale   text,
  quante    integer,
  totale    numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tasca uuid;
begin
  -- `security definer` gira senza RLS: il portiere va rimesso dentro, e chi
  -- non deve vedere riceve un RIFIUTO, non un elenco vuoto — un elenco
  -- vuoto si leggerebbe «non ha speso niente» (regola del 13/08).
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere quanto e'' uscito dalla tasca';
  end if;

  select id into v_tasca from entities where entity_type = 'tasca' limit 1;
  if v_tasca is null then return; end if;

  return query
  select coalesce(c.label, 'senza causale')::text,
         count(*)::integer,
         sum(m.amount)::numeric
    from cash_movements m
    left join cash_causali c on c.id = m.causale_id
   where m.entity_id = v_tasca
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)
   group by coalesce(c.label, 'senza causale')
   order by 3 desc;
end;
$fn$;

revoke all on function speso_dalla_tasca(date, date) from public, anon, authenticated;
grant execute on function speso_dalla_tasca(date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ TUTTO DENTRO UNA SOTTO-TRANSAZIONE CHE VIENE ANNULLATA (decisione del
--    30/08): non si cancella niente, quindi il registro delle cancellazioni
--    resta acceso per tutto il tempo e non c'e' nessuna lapide finta da
--    togliere. E la verifica lavora su roba propria, mai su righe di Alessio.
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_tasca  uuid;
  v_srls   uuid;
  v_caus   uuid;
  v_ded    uuid;
  v_ind    uuid;
  v_tit    uuid;
  v_mov    uuid;
  v_preso  boolean;
  v_n      integer;
begin
  select id into v_tasca from entities where entity_type = 'tasca';
  if v_tasca is null then raise exception 'La tasca non e'' stata creata.'; end if;

  select id into v_srls from entities where entity_type = 'srls';
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_srls is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  select id into v_ind from regole_deducibilita where percentuale_deducibile = 0 order by ordine limit 1;
  select id into v_ded from regole_deducibilita where percentuale_deducibile > 0 order by ordine limit 1;
  if v_ind is null or v_ded is null then
    raise exception 'Servono una regola indeducibile e una deducibile per provare il rifiuto.';
  end if;

  select id into v_caus from cash_causali where kind = 'uscita' and active order by created_at limit 1;
  if v_caus is null then raise exception 'Serve una causale di uscita.'; end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    -- (1) UN'USCITA SENZA REGOLA NASCE «INDEDUCIBILE» DA SE'.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose)
    values (v_tasca, 'uscita', 12.34, current_date, v_caus, 'cassa', 'ZZ verifica tasca')
    returning id into v_mov;
    if (select regola_deducibilita_id from cash_movements where id = v_mov) is distinct from v_ind then
      raise exception 'La spesa della tasca non e'' stata segnata «Indeducibile» da sola.';
    end if;

    -- (2) UN'ENTRATA E' RESPINTA.
    v_preso := false;
    begin
      insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose)
      values (v_tasca, 'entrata', 5, current_date, 'cassa', 'ZZ verifica tasca entrata');
    exception when others then
      v_preso := true;
      if sqlerrm not like '%escono soldi e basta%' then
        raise exception 'L''entrata e'' stata respinta, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Un''entrata sulla tasca NON e'' stata respinta.'; end if;

    -- (3) UNA REGOLA DIVERSA DA «INDEDUCIBILE» E' RESPINTA, non sovrascritta.
    v_preso := false;
    begin
      insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo,
                                  business_purpose, regola_deducibilita_id)
      values (v_tasca, 'uscita', 7, current_date, v_caus, 'cassa', 'ZZ verifica tasca deducibile', v_ded);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%solo «Indeducibile»%' then
        raise exception 'La regola diversa e'' stata respinta, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'Una regola deducibile sulla tasca NON e'' stata respinta.'; end if;

    -- (4) LA SOCIETA' NON E' TOCCATA: la' un'entrata con regola deducibile passa.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo,
                                business_purpose, regola_deducibilita_id)
    values (v_srls, 'entrata', 9, current_date, 'cassa', 'ZZ verifica srls', v_ded);

    -- (5) I PARAMETRI FISCALI SULLA TASCA SONO RESPINTI.
    v_preso := false;
    begin
      insert into fiscal_settings (entity_id) values (v_tasca);
    exception when others then
      v_preso := true;
      if sqlerrm not like '%non e'' una societa''%' then
        raise exception 'I parametri fiscali sono stati respinti, ma col messaggio sbagliato: %', sqlerrm;
      end if;
    end;
    if not v_preso then raise exception 'I parametri fiscali sulla tasca NON sono stati respinti.'; end if;

    -- (6) IL CONTO SI LEGGE, e solo dal titolare.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    select count(*) into v_n from speso_dalla_tasca();
    if v_n < 1 then raise exception 'Il conto della tasca non riporta la spesa appena scritta.'; end if;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  -- Dopo l'annullamento non deve restare niente, e le lapidi devono essere
  -- le stesse: se qualcosa fosse stato cancellato invece che annullato, il
  -- registro lo direbbe.
  perform pretendi_nessun_residuo(v_foto, 'la verifica della tasca');

  raise notice 'Fatto: la tasca esiste, registra solo uscite, e'' sempre indeducibile e non puo'' avere parametri fiscali. Provato nei due versi e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260830000012', 'la_tasca_di_alessio') on conflict (version) do nothing;
