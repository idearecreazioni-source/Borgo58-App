-- ---------------------------------------------------------------------
-- "Siamo chiusi" e "non abbiamo più posto" non sono la stessa frase
-- ---------------------------------------------------------------------
-- Trovato dal vivo il 10/08/2026, chiedendo la disponibilità come farebbe
-- un ospite, subito dopo che Alessio aveva compilato i suoi orari veri:
-- il lunedì — giorno di chiusura — il sito rispondeva «Per questa data non
-- abbiamo più posto». Un cliente che prova due lunedì di fila conclude che
-- l'osteria è sempre piena e non riprova più.
--
-- La funzione aveva un solo modo di dire "niente orari" e lo usava per tre
-- situazioni diverse:
--   1. quel giorno non siamo aperti          → «siamo chiusi»
--   2. siamo aperti ma è troppo tardi        → «per oggi non online, chiama»
--   3. siamo aperti e il locale è pieno      → «non abbiamo più posto»
--
-- La 2 capita OGNI SERA dopo l'ultimo ingresso: è il caso più frequente
-- dei tre, ed è anche quello in cui una telefonata può ancora salvare un
-- coperto. Dirgli "siamo pieni" lo manderebbe altrove per niente.
--
-- Cambia solo il testo restituito: nessuna modifica a tabelle o permessi.
-- Idempotente (§7 punto 3).

create or replace function public_reservation_options(p_date date, p_party_size integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attivo    boolean;
  v_giorni    integer;
  v_preavviso integer;
  v_oggi      date := (now() at time zone 'Europe/Rome')::date;
  v_adesso    timestamp := (now() at time zone 'Europe/Rome');
  v_motivo    text;
  v_max_tavolo integer;
  v_orari     jsonb := '[]'::jsonb;
  r           record;
  v_slot      timestamp;
  v_fine      timestamp;
  v_servizi   integer := 0;  -- servizi aperti quel giorno della settimana
  v_in_tempo  integer := 0;  -- orari ancora prenotabili (preavviso rispettato)
begin
  select prenotazioni_online_attive, giorni_prenotabili, preavviso_minuti
    into v_attivo, v_giorni, v_preavviso
  from service_settings where id = 1;

  -- Interruttore spento: il form torna a essere una richiesta libera.
  if not coalesce(v_attivo, false) then
    return jsonb_build_object('attivo', false, 'orari', v_orari);
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > 30 then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', 'Per gruppi così numerosi chiamaci: troviamo la sistemazione giusta.', 'orari', v_orari);
  end if;

  if p_date is null or p_date < v_oggi or p_date > v_oggi + v_giorni then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', 'Per questa data non prendiamo ancora prenotazioni online.', 'orari', v_orari);
  end if;

  select motivo into v_motivo from service_closures
   where p_date between dal and al
   order by dal limit 1;
  if found then
    return jsonb_build_object('attivo', true, 'chiuso', true,
      'motivo', coalesce(nullif(trim(v_motivo), ''), 'Quel giorno siamo chiusi.'), 'orari', v_orari);
  end if;

  select max(seats) into v_max_tavolo from dining_tables where active;

  for r in
    select apertura, ultimo_ingresso
    from service_hours
    where attivo and weekday = extract(dow from p_date)::smallint
    order by apertura
  loop
    v_servizi := v_servizi + 1;
    v_slot := p_date + r.apertura;
    v_fine := p_date + r.ultimo_ingresso;
    while v_slot <= v_fine loop
      if v_slot >= v_adesso + make_interval(mins => v_preavviso) then
        v_in_tempo := v_in_tempo + 1;
        if posti_liberi(v_slot) >= p_party_size then
          v_orari := v_orari || to_jsonb(to_char(v_slot, 'HH24:MI'));
        end if;
      end if;
      v_slot := v_slot + interval '15 minutes';
    end loop;
  end loop;

  return jsonb_build_object(
    'attivo', true,
    'chiuso', jsonb_array_length(v_orari) = 0,
    'motivo', case
      when v_servizi = 0 then
        'Quel giorno siamo chiusi.'
      when v_in_tempo = 0 then
        'Per oggi non prendiamo più prenotazioni online. Chiamaci pure: se c''è posto te lo diciamo subito.'
      when jsonb_array_length(v_orari) = 0 then
        'Per questa data non abbiamo più posto. Prova un altro giorno, oppure chiamaci: a volte si libera qualcosa.'
    end,
    -- Oltre il tavolo più grande servono tavoli uniti: si può chiedere lo
    -- stesso, ma il cliente sa già che lo richiamiamo.
    'gruppo_grande', p_party_size > coalesce(v_max_tavolo, 0),
    'orari', v_orari
  );
end;
$$;

comment on function public_reservation_options is
  'Ciò che il form pubblico mostra prima dell''invio. Distingue tre "niente orari": chiuso quel giorno, troppo tardi per oggi, locale pieno. Non espone dati di altri clienti.';

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_attivo_pre    boolean;
  v_preavviso_pre integer;
  v_chiuso        date;
  v_aperto        date;
  v_esito         jsonb;
  v_i             integer;
  v_dow_finto     smallint;
  v_tavolo_finto  uuid;
begin
  select prenotazioni_online_attive, preavviso_minuti
    into v_attivo_pre, v_preavviso_pre
  from service_settings where id = 1;

  -- Su un database appena ricostruito da zero (il progetto di prova) non
  -- c'è nessun servizio acceso e nessun tavolo: sono dati del locale, che
  -- nessuna migrazione crea. Senza di essi le tre frasi non si possono
  -- provare. In quel caso — e solo in quello — la verifica si apre da sé
  -- una cena e un tavolo per domani, e li richiude alla fine. Dove gli
  -- orari veri esistono (produzione) questi due rami non si percorrono.
  if not exists (select 1 from service_hours where attivo) then
    v_dow_finto := extract(dow from ((now() at time zone 'Europe/Rome')::date + 1))::smallint;
    update service_hours set attivo = true where weekday = v_dow_finto and servizio = 'cena';
  end if;
  if coalesce((select sum(seats) from dining_tables where active), 0) = 0 then
    insert into dining_tables (label, seats, active)
    values ('__prova_messaggi__', 20, true)
    on conflict (label) do update set seats = 20, active = true
    returning id into v_tavolo_finto;
  end if;

  -- Serve un giorno senza servizi e uno con servizi, nei prossimi 14
  for v_i in 1..14 loop
    if not exists (
      select 1 from service_hours
      where attivo and weekday = extract(dow from ((now() at time zone 'Europe/Rome')::date + v_i))::smallint
    ) then
      v_chiuso := (now() at time zone 'Europe/Rome')::date + v_i;
    else
      v_aperto := coalesce(v_aperto, (now() at time zone 'Europe/Rome')::date + v_i);
    end if;
  end loop;

  -- Con l'interruttore spento non c'è niente da verificare qui: le frasi
  -- non escono proprio. Si accende solo per la durata della prova.
  update service_settings set prenotazioni_online_attive = true where id = 1;

  if v_chiuso is not null then
    v_esito := public_reservation_options(v_chiuso, 2);
    if v_esito ->> 'motivo' not like '%chius%' then
      raise exception 'In un giorno di chiusura il messaggio è ancora "%"', v_esito ->> 'motivo';
    end if;
  else
    raise notice 'Nessun giorno di chiusura nelle prossime due settimane: quel messaggio non è stato provato.';
  end if;

  if v_aperto is not null then
    -- Un giorno aperto deve proporre orari...
    v_esito := public_reservation_options(v_aperto, 2);
    if jsonb_array_length(v_esito -> 'orari') = 0 then
      raise exception 'Un giorno aperto e con posto non propone nessun orario.';
    end if;
    if v_esito ->> 'motivo' is not null then
      raise exception 'Con orari disponibili non deve esserci nessun messaggio, invece c''è "%"', v_esito ->> 'motivo';
    end if;

    -- ...e con un preavviso assurdo deve dire "troppo tardi", non "pieno".
    -- Il preavviso massimo ammesso è una settimana: se il primo giorno
    -- aperto fosse più in là non basterebbe a coprirlo, e la prova
    -- fallirebbe senza che ci sia niente di rotto.
    if v_aperto <= (now() at time zone 'Europe/Rome')::date + 7 then
      update service_settings set preavviso_minuti = 10080 where id = 1;
      v_esito := public_reservation_options(v_aperto, 2);
      if v_esito ->> 'motivo' not like '%non prendiamo più%' then
        raise exception 'Fuori tempo massimo il messaggio è "%" invece di quello giusto.', v_esito ->> 'motivo';
      end if;
    else
      raise notice 'Primo giorno aperto oltre la settimana: il messaggio "troppo tardi" non è stato provato.';
    end if;
  else
    raise exception 'Nessun servizio aperto nelle prossime due settimane: impossibile verificare.';
  end if;

  -- Si torna esattamente com'era
  update service_settings
     set preavviso_minuti = v_preavviso_pre,
         prenotazioni_online_attive = coalesce(v_attivo_pre, false)
   where id = 1;
  if v_dow_finto is not null then
    update service_hours set attivo = false where weekday = v_dow_finto and servizio = 'cena';
  end if;
  delete from dining_tables where id = v_tavolo_finto;

  raise notice 'Le tre frasi sono distinte: chiuso, troppo tardi, pieno. Impostazioni riportate com''erano (preavviso %, online %).', v_preavviso_pre, coalesce(v_attivo_pre, false);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260810000002', 'messaggi_giusti')
on conflict (version) do nothing;

-- Riepilogo: cosa risponde davvero il sito nei prossimi 7 giorni.
select
  g::date                                                                  as giorno,
  jsonb_array_length(public_reservation_options(g::date, 2) -> 'orari')     as orari_per_due,
  public_reservation_options(g::date, 2) ->> 'motivo'                       as messaggio
from generate_series((now() at time zone 'Europe/Rome')::date,
                     (now() at time zone 'Europe/Rome')::date + 6,
                     interval '1 day') as g;
