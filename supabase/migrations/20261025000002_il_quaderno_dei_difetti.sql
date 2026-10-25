-- =====================================================================
-- IL QUADERNO DEI DIFETTI — 25/10/2026, tappa 1 del piano «MEMO che
-- controlla» (https://claude.ai/artifact/4KX98SDkCQApnd414xJVSZ)
-- =====================================================================
-- Chiesto da Alessio il 25/10: «tramite lui potessimo apportare delle
-- modifiche al gestionale man mano che troviamo difetti... potrebbe
-- indicarti tutti i difetti che troviamo». Deciso da lui lo stesso giorno:
--   · le segnalazioni le fa SOLO il titolare (lo staff no);
--   · restano DENTRO il gestionale, non su GitHub;
--   · Claude le raccoglie ogni sera.
--
-- 🔴 PERCHE' NON SU GITHUB. Il repository e' PUBBLICO (misurato il 25/10
--    dall'API: `visibility: public`). Una segnalazione porta con se' cio'
--    che c'era a schermo — la Cassa, una fattura, un saldo — e su GitHub lo
--    leggerebbe chiunque. Qui la legge solo il titolare; Claude la legge
--    col connettore in sola lettura, che e' gia' l'accesso che ha.
--
-- 🔴 UNA SEGNALAZIONE NON TOCCA NIENTE. Non e' un dato del locale e non
--    produce effetti altrove: e' un appunto per chi sviluppa. Per questo si
--    scrive DRITTA dal browser (una tabella sola, senza conseguenze: regola
--    del Contratto, nessun corridoio) con la RLS come barriera.
--
-- ⚠️ «COSA SI VEDEVA» E' TESTO, NON UNA FOTO. Il gestionale salva da se'
--    il testo della schermata nel momento in cui si preme «Segnala»: e'
--    cio' che serve per capire il difetto, non pesa nel deposito e non
--    lascia file da ripulire. La foto, se servira', e' un passo a parte.
--
-- ⚠️ La provenienza e' un vocabolario chiuso SENZA predefinito: un valore
--    predefinito risponderebbe al posto di chi scrive (CLAUDE.md §6, i 33
--    posti silenziosi). Oggi esiste solo «pulsante»; «voce» arrivera' con
--    MEMO voce, «controllo» con i controlli della tappa 4.

-- ---------------------------------------------------------------------
-- 1. Il quaderno
-- ---------------------------------------------------------------------
create table if not exists segnalazioni (
  id               uuid primary key default gen_random_uuid(),
  testo            text not null,
  provenienza      text not null,
  -- Dove si era quando si e' premuto «Segnala». Tutto facoltativo: una
  -- segnalazione senza contesto vale lo stesso, solo e' piu' faticosa.
  schermata        text,
  titolo_schermata text,
  cosa_si_vedeva   text,
  contesto         jsonb not null default '{}'::jsonb,
  -- Cosa ne e' stato.
  stato            text not null default 'nuova',
  esito            text,
  creata_il        timestamptz not null default now(),
  creata_da        uuid references auth.users(id) on delete set null default auth.uid(),
  aggiornata_il    timestamptz
);

comment on table segnalazioni is
  'Il quaderno dei difetti (25/10/2026): le cose che non vanno nel gestionale, segnalate dal titolare mentre lo usa. Un appunto per chi sviluppa, non un dato del locale: non produce effetti altrove. Claude le legge ogni sera e prepara le correzioni, che entrano nel gestionale vero solo con l''ok di Alessio.';
comment on column segnalazioni.cosa_si_vedeva is
  'Il testo della schermata nel momento della segnalazione, salvato dal gestionale. Tagliato a 20.000 caratteri. Puo'' contenere dati economici: per questo la tabella e'' solo del titolare.';
comment on column segnalazioni.contesto is
  'Cio'' che il gestionale sa da se'' del momento: la versione pubblicata, la larghezza dello schermo, a quale database era collegato. Serve a riprodurre il difetto.';
comment on column segnalazioni.esito is
  'Cosa ne e'' stato, in parole: quale correzione l''ha chiusa, oppure perche'' e'' stata scartata. Vuoto finche'' nessuno l''ha scritto.';
comment on column segnalazioni.aggiornata_il is
  'L''ultima volta che la riga e'' cambiata. La scrive il database, mai l''applicazione. Vuoto vuol dire mai toccata dopo la nascita.';

alter table segnalazioni drop constraint if exists segnalazione_testo_sensato;
alter table segnalazioni add constraint segnalazione_testo_sensato
  check (char_length(btrim(testo)) between 3 and 4000);
comment on constraint segnalazione_testo_sensato on segnalazioni is
  'Scrivi cosa non va in qualche parola (almeno tre lettere, al massimo quattromila caratteri).';

alter table segnalazioni drop constraint if exists segnalazione_provenienza_nota;
alter table segnalazioni add constraint segnalazione_provenienza_nota
  check (provenienza in ('pulsante', 'voce', 'controllo'));
comment on constraint segnalazione_provenienza_nota on segnalazioni is
  'Una segnalazione arriva dal pulsante «Segnala», da MEMO voce oppure da un controllo del gestionale: scrivi «pulsante», «voce» o «controllo».';

alter table segnalazioni drop constraint if exists segnalazione_stato_noto;
alter table segnalazioni add constraint segnalazione_stato_noto
  check (stato in ('nuova', 'in_lavorazione', 'corretta', 'scartata'));
comment on constraint segnalazione_stato_noto on segnalazioni is
  'Una segnalazione e'' nuova, in lavorazione, corretta oppure scartata: non ci sono altri stati.';

alter table segnalazioni drop constraint if exists segnalazione_cosa_si_vedeva_misurato;
alter table segnalazioni add constraint segnalazione_cosa_si_vedeva_misurato
  check (cosa_si_vedeva is null or char_length(cosa_si_vedeva) <= 20000);
comment on constraint segnalazione_cosa_si_vedeva_misurato on segnalazioni is
  'Il testo della schermata salvato con la segnalazione non supera i 20.000 caratteri.';

create index if not exists idx_segnalazioni_aperte
  on segnalazioni(creata_il) where stato in ('nuova', 'in_lavorazione');

-- ---------------------------------------------------------------------
-- 2. «Aggiornata il» la scrive il database
-- ---------------------------------------------------------------------
create or replace function segnalazione_aggiornata()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.aggiornata_il := now();
  return new;
end $fn$;

revoke all on function segnalazione_aggiornata() from public, anon, authenticated;

drop trigger if exists trg_segnalazione_aggiornata on segnalazioni;
create trigger trg_segnalazione_aggiornata
  before update on segnalazioni
  for each row execute function segnalazione_aggiornata();

-- ---------------------------------------------------------------------
-- 3. Solo del titolare
-- ---------------------------------------------------------------------
alter table segnalazioni enable row level security;
drop policy if exists segnalazioni_titolare on segnalazioni;
create policy segnalazioni_titolare on segnalazioni
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ Dopo la nascita si cambiano solo stato ed esito: testo e contesto
--    sono la testimonianza di quel momento, e riscriverli dopo farebbe
--    cercare un difetto diverso da quello visto.
revoke all on segnalazioni from public, anon, authenticated;
grant select, insert, delete on segnalazioni to authenticated;
grant update (stato, esito) on segnalazioni to authenticated;

insert into perimetro_registro (tabella, dentro, ragione) values
  ('segnalazioni', false,
   'Un appunto per chi sviluppa, non un dato del locale: una segnalazione fatta per sbaglio si toglie e basta, senza lapide. Fuori dal 25/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
-- ⚠️ La RLS qui non si puo' provare: le migrazioni girano come
--    proprietarie e la scavalcano (CLAUDE.md §8, 16/08). La prova che lo
--    staff non vede e non scrive sta in `tests/app/segnalazioni.test.js`.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_id       uuid;
  v_r        segnalazioni%rowtype;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  -- Le porte: niente agli anonimi; lo staff passa dai permessi di
  -- `authenticated`, quindi a fermarlo e' la policy, che deve esistere.
  if has_table_privilege('anon', 'segnalazioni', 'select')
     or has_table_privilege('anon', 'segnalazioni', 'insert') then
    raise exception 'VERIFICA: il quaderno dei difetti e'' aperto agli anonimi.';
  end if;
  if has_column_privilege('authenticated', 'segnalazioni', 'testo', 'update')
     or has_column_privilege('authenticated', 'segnalazioni', 'cosa_si_vedeva', 'update')
     or not has_column_privilege('authenticated', 'segnalazioni', 'stato', 'update') then
    raise exception 'VERIFICA: dopo la nascita si devono poter cambiare solo stato ed esito.';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'segnalazioni'
                   and policyname = 'segnalazioni_titolare' and 'authenticated' = any(roles)) then
    raise exception 'VERIFICA: manca la regola che riserva il quaderno al titolare.';
  end if;
  if (select dentro from perimetro_registro where tabella = 'segnalazioni') is distinct from false then
    raise exception 'VERIFICA: il quaderno non e'' classificato fuori dal registro delle cancellazioni.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Nasce nuova, del titolare, mai toccata.
    insert into segnalazioni (testo, provenienza, schermata, cosa_si_vedeva, contesto)
    values ('ZZ verifica: il latte risulta senza quantita''', 'pulsante', '/magazzino',
            'Latte intero — 0 l', jsonb_build_object('larghezza', 390))
    returning id into v_id;
    select * into v_r from segnalazioni where id = v_id;
    if v_r.stato is distinct from 'nuova' or v_r.creata_da is distinct from v_titolare
       or v_r.aggiornata_il is not null then
      raise exception 'VERIFICA (1): la segnalazione e'' nata come «%», di %, aggiornata %.',
        v_r.stato, v_r.creata_da, v_r.aggiornata_il;
    end if;

    -- (2) Cambiando stato, «aggiornata il» la scrive il database.
    update segnalazioni set stato = 'corretta', esito = 'ZZ chiusa dalla verifica' where id = v_id;
    select * into v_r from segnalazioni where id = v_id;
    if v_r.stato is distinct from 'corretta' or v_r.aggiornata_il is null then
      raise exception 'VERIFICA (2): dopo il cambio di stato: «%», aggiornata %.', v_r.stato, v_r.aggiornata_il;
    end if;

    -- (3) Uno stato inventato si rifiuta, con la sua frase.
    v_respinto := false;
    begin
      update segnalazioni set stato = 'chiusa' where id = v_id;
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (3): uno stato inventato e'' passato.'; end if;

    -- (4) Una provenienza mancante si rifiuta: nessun predefinito risponde.
    v_respinto := false;
    begin
      insert into segnalazioni (testo) values ('ZZ verifica senza provenienza');
    exception when not_null_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (4): una segnalazione senza provenienza e'' passata.'; end if;

    -- (5) Un testo vuoto si rifiuta.
    v_respinto := false;
    begin
      insert into segnalazioni (testo, provenienza) values ('  ', 'pulsante');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (5): una segnalazione vuota e'' passata.'; end if;

    -- (6) Ogni vincolo nuovo ha la sua frase in italiano: un rifiuto
    --     senza frase arriverebbe a schermo in inglese. (Qui dentro perche'
    --     `vincoli_senza_frase` ha il suo portiere.)
    if exists (select 1 from vincoli_senza_frase() v where v.tabella = 'segnalazioni') then
      raise exception 'VERIFICA (6): un vincolo del quaderno non ha la sua frase in italiano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del quaderno dei difetti');

  raise notice 'Fatto: il quaderno dei difetti esiste, nasce «nuova», si chiude con un esito, rifiuta stati e provenienze inventati. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000002', 'il_quaderno_dei_difetti')
on conflict (version) do nothing;
