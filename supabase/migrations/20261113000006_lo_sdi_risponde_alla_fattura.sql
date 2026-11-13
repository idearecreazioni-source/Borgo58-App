-- =====================================================================
-- LO SDI RISPONDE ALLA FATTURA (13/11/2026) — pezzo 4 di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md),
-- via al pezzo 4 dato da Alessio («Parti col pezzo 4»).
--
-- Dopo l'invio dalla PEC (pezzo 3), lo SdI risponde alla stessa PEC con una
-- ricevuta: consegnata (RC), messa a disposizione nel cassetto fiscale del
-- cliente (MC), scartata con gli errori (NS). La legge `posta-leggi` senza
-- modello (`_shared/ricevuteSdi.js`) e la registra qui:
--
--   1. `fatture_emesse_ricevute`: ogni ricevuta, legata all'invio col
--      nome del file. Una ricevuta già vista non si conta due volte.
--   2. `registra_ricevuta_sdi()`: la aggancia all'invio per NOME DEL FILE
--      (unico, pezzo 3) e porta la fattura allo stato giusto. In più:
--        · se l'invio era rimasto «in partenza» (esito incerto, pezzo 3),
--          la ricevuta prova che è partito: si chiude come partito;
--        · l'indirizzo da cui lo SdI ha risposto (sdiNN) diventa quello a
--          cui scrivere d'ora in poi (`service_settings.sdi_pec`);
--        · conta solo la ricevuta dell'ULTIMO invio della fattura: uno
--          scarto in ritardo di un invio vecchio non cancella una consegna.
--
-- ⚠️ LA CHIAMA SOLO IL SERVIZIO (service_role, da posta-leggi): non è un
--    gesto del titolare. È security definer perché la guardia delle fatture
--    lascia cambiare lo stato di una fattura uscita solo «da dentro».
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

-- ---------------------------------------------------------------------
-- 1. LE RICEVUTE
-- ---------------------------------------------------------------------
create table if not exists fatture_emesse_ricevute (
  id                 uuid primary key default gen_random_uuid(),
  invio_id           uuid not null,
  tipo               text not null,
  identificativo_sdi text,
  ricevuta_il        timestamptz,
  nota               text,
  posta_id           uuid,
  creato_il          timestamptz not null default now(),
  constraint fatture_emesse_ricevute_invio_id_fkey foreign key (invio_id) references fatture_emesse_invii(id) on delete restrict,
  constraint fatture_emesse_ricevute_posta_id_fkey foreign key (posta_id) references posta_ricevuta(id) on delete set null,
  constraint fatture_emesse_ricevute_tipo_check check (tipo = any (array['RC', 'NS', 'MC', 'AT', 'NE', 'DT'])),
  constraint fatture_emesse_ricevute_una_per_tipo unique (invio_id, tipo)
);

create index if not exists fatture_emesse_ricevute_invio_idx on fatture_emesse_ricevute (invio_id);

comment on table fatture_emesse_ricevute is
  'Le ricevute dello SdI per le fatture ai clienti (13/11/2026): consegna (RC), messa a disposizione (MC), scarto (NS), e quelle delle fatture alla PA (AT, NE, DT), legate all''invio per nome del file. Le scrive solo registra_ricevuta_sdi.';
comment on constraint fatture_emesse_ricevute_invio_id_fkey on fatture_emesse_ricevute is
  'La ricevuta è di un invio che non esiste, oppure si sta cancellando un invio che ha già una risposta dello SdI.';
comment on constraint fatture_emesse_ricevute_posta_id_fkey on fatture_emesse_ricevute is
  'La mail da cui è arrivata la ricevuta non esiste.';
comment on constraint fatture_emesse_ricevute_tipo_check on fatture_emesse_ricevute is
  'Le ricevute dello SdI sono RC (consegnata), NS (scartata), MC (messa a disposizione), AT, NE, DT (fatture alla Pubblica Amministrazione).';
comment on constraint fatture_emesse_ricevute_una_per_tipo on fatture_emesse_ricevute is
  'Questa ricevuta dello SdI per questo invio è già registrata.';

alter table fatture_emesse_ricevute enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fatture_emesse_ricevute'
                  and policyname = 'fatture_emesse_ricevute_titolare_legge') then
    create policy fatture_emesse_ricevute_titolare_legge on fatture_emesse_ricevute
      for select using ((select is_titolare()));
  end if;
end $$;
revoke all on table fatture_emesse_ricevute from public, anon, authenticated;
grant select on table fatture_emesse_ricevute to authenticated;

-- ---------------------------------------------------------------------
-- 2. REGISTRARE UNA RICEVUTA
-- ---------------------------------------------------------------------
create or replace function registra_ricevuta_sdi(
  p_nome_file      text,
  p_tipo           text,
  p_identificativo text,
  p_quando         timestamptz,
  p_nota           text,
  p_mittente_sdi   text,
  p_posta_id       uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_i        fatture_emesse_invii%rowtype;
  v_f        fatture_emesse%rowtype;
  v_ultimo   uuid;
  v_nuova    uuid;
  v_stato    text;
  v_conta    boolean;
  v_doppio   boolean := false;
begin
  if p_tipo is null or p_tipo not in ('RC', 'NS', 'MC', 'AT', 'NE', 'DT') then
    raise exception 'Tipo di ricevuta dello SdI sconosciuto: %.', p_tipo using errcode = 'P0001';
  end if;

  select * into v_i from fatture_emesse_invii where nome_file = p_nome_file for update;
  if not found then
    -- Una ricevuta per un file che non è nostro (o di un altro gestionale):
    -- si dice a chi chiama, che la lascia da leggere a mano.
    return jsonb_build_object('trovata', false);
  end if;
  select * into v_f from fatture_emesse where id = v_i.fattura_id for update;

  v_stato := case p_tipo when 'RC' then 'consegnata'
                         when 'MC' then 'messa_a_disposizione'
                         when 'NS' then 'scartata' end;

  insert into fatture_emesse_ricevute (invio_id, tipo, identificativo_sdi, ricevuta_il, nota, posta_id)
  values (v_i.id, p_tipo, nullif(btrim(p_identificativo), ''), p_quando, nullif(btrim(p_nota), ''), p_posta_id)
  on conflict (invio_id, tipo) do nothing
  returning id into v_nuova;

  if v_nuova is not null and v_i.stato <> 'simulato' then
    -- Una ricevuta PROVA che il file è partito.
    --  · in partenza (esito incerto, pezzo 3): si chiude da sé;
    --  · fallito (sbloccato come «non c'è», ma era partito): si riapre, e
    --    se nel frattempo ne è partito un altro è un possibile DOPPIONE,
    --    da dire (revisione del 13/11).
    if v_i.stato in ('in_partenza', 'fallito') then
      v_doppio := v_i.stato = 'fallito' and exists (
        select 1 from fatture_emesse_invii
         where fattura_id = v_f.id and id <> v_i.id and stato in ('partito', 'in_partenza'));
      update fatture_emesse_invii
         set stato = 'partito', concluso_il = coalesce(concluso_il, now()),
             errore = 'Chiuso dalla ricevuta dello SdI: il file era partito.'
       where id = v_i.id;
      v_i.stato := 'partito';
      if v_f.stato in ('da_inviare', 'scartata') and not v_doppio then
        update fatture_emesse set stato = 'inviata', nome_file = v_i.nome_file, inviata_il = v_i.creato_il
         where id = v_f.id;
        v_f.stato := 'inviata';
      end if;
    end if;

    -- L'indirizzo da cui lo SdI risponde è quello a cui scrivere d'ora in
    -- poi: solo da una ricevuta vera di un invio partito.
    if p_mittente_sdi ~* '^sdi[0-9]{2}@pec\.fatturapa\.it$' then
      update service_settings set sdi_pec = lower(p_mittente_sdi)
       where id = 1 and sdi_pec is distinct from lower(p_mittente_sdi);
    end if;
  end if;

  -- Conta solo la ricevuta dell'ULTIMO invio partito della fattura.
  select id into v_ultimo from fatture_emesse_invii
   where fattura_id = v_f.id and stato in ('partito', 'in_partenza')
   -- a parità di ora (due invii nella stessa transazione) decide il
   -- progressivo, che cresce sempre: 5 caratteri fissi, l'ordine del testo è quello dei numeri
   order by creato_il desc, progressivo desc limit 1;
  v_conta := v_stato is not null and v_ultimo = v_i.id;

  if v_nuova is not null and v_conta
     -- ⚠️ CHI È GIÀ ARRIVATO RESTA ARRIVATO (revisione del 13/11):
     --    consegnata non cambia più; messa a disposizione cambia solo in
     --    consegnata. Uno scarto «dopo» non è una cosa che lo SdI fa.
     and not (v_f.stato = 'consegnata')
     and not (v_f.stato = 'messa_a_disposizione' and v_stato <> 'consegnata') then
    update fatture_emesse
       set stato = v_stato,
           identificativo_sdi = coalesce(nullif(btrim(p_identificativo), ''), identificativo_sdi),
           esito_il = coalesce(p_quando, now()),
           esito_note = nullif(btrim(p_nota), '')
     where id = v_f.id;
    v_f.stato := v_stato;
  end if;

  -- `conta` anche per una ricevuta già vista: se la mail viene riletta
  -- (un guasto a metà), l'avviso si rifà invece di perdersi.
  return jsonb_build_object('trovata', true, 'gia_vista', v_nuova is null,
    'numero', v_f.numero, 'anno', v_f.anno, 'stato', v_f.stato,
    'conta', v_conta and v_f.stato = v_stato, 'doppio', v_doppio);
end;
$fn$;

comment on function registra_ricevuta_sdi(text, text, text, timestamptz, text, text, uuid) is
  'Registra una ricevuta dello SdI per una fattura ai clienti (13/11/2026): la lega all''invio per nome del file, chiude un invio rimasto a metà, aggiorna l''indirizzo sdiNN e porta la fattura a consegnata, messa a disposizione o scartata se la ricevuta è dell''ultimo invio. La chiama solo posta-leggi (service_role).';

revoke all on function registra_ricevuta_sdi(text, text, text, timestamptz, text, text, uuid) from public, anon, authenticated;
grant execute on function registra_ricevuta_sdi(text, text, text, timestamptz, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) una ricevuta per un file sconosciuto non tocca niente;
--   (2) la consegna: fattura «consegnata», identificativo, ora, sdiNN nuovo;
--   (3) la stessa ricevuta due volte: registrata una volta sola;
--   (4) lo scarto: fattura «scartata» con la nota, e poi un rinvio parte;
--   (5) una ricevuta in ritardo di un invio VECCHIO non tocca la fattura;
--   (6) un invio rimasto a metà si chiude da sé con la ricevuta;
--   (7) la mancata consegna: messa a disposizione;
--   (8) da fuori non si chiama; ogni vincolo nuovo ha la sua frase;
--   (9) consegnata resta consegnata (uno scarto o una mancata consegna
--       dopo non la cambiano), e un mittente che non è sdiNN non cambia
--       l'indirizzo;
--  (10) una ricevuta per un invio sbloccato come «non partito» lo riapre;
--       se intanto ne è partito un altro, lo dice (possibile doppione).
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_srls      uuid;
  v_cli       uuid;
  v_f         uuid;
  v_g         uuid;
  v_h         uuid;
  v_p         jsonb;
  v_p2        jsonb;
  v_r         jsonb;
  v_ok        boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    update entities set vat_number = '01343950869', legal_name = 'Borgo 58 S.r.l.s.',
           sede_indirizzo = 'Via Prova 58', sede_cap = '84043', sede_comune = 'Agropoli', sede_provincia = 'SA'
     where id = v_srls;
    update service_settings set sdi_pec = 'sdi01@pec.fatturapa.it' where id = 1;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Ditta delle ricevute srl', '01234567897', 'Via Prova 6', '84043', 'Agropoli', 'SA')
    returning id into v_cli;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena', 2, 55.00);
    v_p := prepara_invio_fattura(v_f);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    reset role;

    -- (1) file sconosciuto
    v_r := registra_ricevuta_sdi('IT01343950869_ZZZZZ.xml', 'RC', '1', now(), null, null, null);
    if (v_r->>'trovata')::boolean then
      raise exception 'VERIFICA (1): una ricevuta per un file sconosciuto è stata agganciata: %', v_r;
    end if;

    -- (2) consegna
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'RC', '9876543210', '2027-01-15 10:05+01', 'Consegnata.', 'SDI38@pec.fatturapa.it', null);
    if not (v_r->>'conta')::boolean
       or not exists (select 1 from fatture_emesse where id = v_f and stato = 'consegnata'
                        and identificativo_sdi = '9876543210' and esito_il = '2027-01-15 10:05+01')
       or (select sdi_pec from service_settings where id = 1) <> 'sdi38@pec.fatturapa.it' then
      raise exception 'VERIFICA (2): la consegna non ha portato la fattura a consegnata, o l''indirizzo sdiNN non è cambiato: %', v_r;
    end if;

    -- (3) due volte
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'RC', '9876543210', now(), null, null, null);
    if not (v_r->>'gia_vista')::boolean
       or (select count(*) from fatture_emesse_ricevute r join fatture_emesse_invii i on i.id = r.invio_id
            where i.fattura_id = v_f) <> 1 then
      raise exception 'VERIFICA (3): la stessa ricevuta è stata contata due volte.';
    end if;

    -- (4) scarto e rinvio, su una seconda fattura
    set local role authenticated;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_g;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_g, 1, 'ZZ Pranzo', 1, 30.00);
    v_p := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    reset role;
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'NS', '111', now(), 'Scartata dallo SdI: 00305 ZZ.', null, null);
    if not exists (select 1 from fatture_emesse where id = v_g and stato = 'scartata' and esito_note like 'Scartata dallo SdI: 00305%') then
      raise exception 'VERIFICA (4): lo scarto non ha portato la fattura a scartata con la nota.';
    end if;
    set local role authenticated;
    v_p2 := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p2->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    reset role;

    -- (5) una ricevuta in ritardo del PRIMO invio non tocca la fattura
    --     (ripartita col secondo); la consegna del secondo sì
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'MC', '112', now(), 'ZZ in ritardo', null, null);
    if (v_r->>'conta')::boolean or not exists (select 1 from fatture_emesse where id = v_g and stato = 'inviata') then
      raise exception 'VERIFICA (5): una ricevuta di un invio vecchio ha cambiato la fattura: %', v_r;
    end if;
    perform registra_ricevuta_sdi(v_p2->>'nome_file', 'RC', '113', now(), null, null, null);
    if not exists (select 1 from fatture_emesse where id = v_g and stato = 'consegnata') then
      raise exception 'VERIFICA (5): la consegna del rinvio non ha portato la fattura a consegnata.';
    end if;

    -- (6) un invio rimasto a metà, chiuso dalla ricevuta; (7) mancata consegna
    set local role authenticated;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_h;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_h, 1, 'ZZ Merenda', 1, 12.00);
    v_p := prepara_invio_fattura(v_h);
    reset role;
    perform registra_ricevuta_sdi(v_p->>'nome_file', 'MC', '114', now(), 'Messa nel cassetto fiscale.', null, null);
    if not exists (select 1 from fatture_emesse_invii where id = (v_p->>'invio_id')::uuid and stato = 'partito')
       or not exists (select 1 from fatture_emesse where id = v_h and stato = 'messa_a_disposizione' and nome_file = v_p->>'nome_file') then
      raise exception 'VERIFICA (6-7): l''invio a metà non si è chiuso con la ricevuta, o la fattura non è messa a disposizione.';
    end if;

    -- (9) consegnata resta consegnata; un mittente falso non cambia l'indirizzo
    v_r := registra_ricevuta_sdi((select nome_file from fatture_emesse where id = v_f), 'NS', '120', now(), 'ZZ scarto finto', 'sdi1@pec.fatturapa.it', null);
    if (v_r->>'conta')::boolean or not exists (select 1 from fatture_emesse where id = v_f and stato = 'consegnata')
       or (select sdi_pec from service_settings where id = 1) <> 'sdi38@pec.fatturapa.it' then
      raise exception 'VERIFICA (9): uno scarto dopo la consegna ha cambiato la fattura, o un mittente falso ha cambiato l''indirizzo: %', v_r;
    end if;

    -- (10) una ricevuta per un invio sbloccato come «non partito»
    set local role authenticated;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_g;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_g, 1, 'ZZ Aperitivo', 1, 8.00);
    v_p := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'fallito', null, 'ZZ la PEC non risponde');
    reset role;
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'RC', '121', now(), null, null, null);
    if (v_r->>'doppio')::boolean
       or not exists (select 1 from fatture_emesse_invii where id = (v_p->>'invio_id')::uuid and stato = 'partito')
       or not exists (select 1 from fatture_emesse where id = v_g and stato = 'consegnata') then
      raise exception 'VERIFICA (10): la ricevuta non ha riaperto l''invio fallito né consegnato la fattura: %', v_r;
    end if;
    set local role authenticated;
    insert into fatture_emesse (entity_id, cliente_id, data) values (v_srls, v_cli, oggi_a_roma()) returning id into v_g;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_g, 1, 'ZZ Dolce', 1, 6.00);
    v_p := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'fallito', null, 'ZZ la PEC non risponde');
    v_p2 := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p2->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    reset role;
    v_r := registra_ricevuta_sdi(v_p->>'nome_file', 'RC', '122', now(), null, null, null);
    if not (v_r->>'doppio')::boolean then
      raise exception 'VERIFICA (10): una ricevuta per un invio fallito, con un rinvio già partito, non ha detto «possibile doppione»: %', v_r;
    end if;

    -- (8) da fuori no; le frasi
    set local role authenticated;
    v_ok := false;
    begin
      perform registra_ricevuta_sdi(v_p->>'nome_file', 'RC', '1', now(), null, null, null);
    exception when insufficient_privilege then
      v_ok := true;
    end;
    if not v_ok then
      raise exception 'VERIFICA (8): da fuori si è registrata una ricevuta dello SdI.';
    end if;
    reset role;
    if exists (select 1 from vincoli_senza_frase() v where v.tabella = 'fatture_emesse_ricevute') then
      raise exception 'VERIFICA (8): un vincolo nuovo è senza frase.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle ricevute dello SdI');

  raise notice 'Fatto: la consegna, lo scarto e la messa a disposizione portano la fattura allo stato giusto; una ricevuta conta una volta, solo per l''ultimo invio; un invio a metà si chiude con la ricevuta; l''indirizzo sdiNN si aggiorna; da fuori non si registra. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000006', 'lo_sdi_risponde_alla_fattura')
on conflict (version) do nothing;
