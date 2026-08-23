-- =====================================================================
-- UN'ALIQUOTA SI SCRIVE IN PUNTI, NON IN FRAZIONE
-- 24/08/2026 — blocco 1 del mandato delle correzioni del collaudo
-- =====================================================================
-- 🔴 IL DIFETTO, MISURATO PRIMA DI CORREGGERLO.
--
-- Nel gestionale di prova la Proiezione mostrava imposte pari allo
-- **0,28% del risultato** — la stessa identica proporzione su due
-- schermate diverse, ed e' quella coincidenza che ha portato alla causa:
-- due difetti indipendenti non danno lo stesso rapporto.
--
-- `fiscal_settings` teneva `ires_rate = 0.24` e `irap_rate = 0.04`.
-- `calcola_imposte()` fa `imponibile * aliquota / 100`, cioe' legge quei
-- campi in **punti percentuali** — e lo dichiarano i valori predefiniti
-- delle colonne stesse: 24.0, 3.9, 100, 40, 20, 1.5. Scritti in frazione,
-- l'aliquota effettiva diventava lo 0,24% invece del 24%.
--
-- La controprova aritmetica, sul risultato vero di quella previsione
-- (2.141.140,64 euro):
--   ora    2.141.140,64 x 0,24/100 + x 0,04/100 =      5.995,20
--   vero   2.141.140,64 x 24,0/100 + x 3,9/100  =    597.378,23
-- I 5.995,20 sono **al centesimo** quelli che si vedevano a schermo.
-- Fattore: 99,6 volte.
--
-- ⚠️ E NON ERA IL RISULTATO A ESSERE CENTO VOLTE TROPPO GRANDE: erano le
-- imposte a essere cento volte troppo PICCOLE. La differenza conta,
-- perche' un utile gonfiato si nota e un'imposta bassa no — e questa
-- sbagliava **sempre nella stessa direzione**, verso il rassicurante.
--
-- ✅ **IL GESTIONALE VERO NON ERA AFFETTO**: letto in sola lettura il
-- 24/08, in produzione ci sono 24,00 / 3,90 / 100 / 40. Il valore
-- sbagliato veniva dallo script che semina il progetto di prova
-- (`scripts/prova-base.mjs`), corretto insieme a questa migrazione.
--
-- ---------------------------------------------------------------------
-- PERCHE' UN VINCOLO E NON SOLO LA CORREZIONE DEL DATO
-- ---------------------------------------------------------------------
-- Perche' la confusione ha una radice che resta: **nello stesso database
-- una percentuale si scrive in due modi**. In `fiscal_settings` sta in
-- punti (24.0); in `scenari_proiezione` sta in frazione
-- (`food_cost_percento` = 0.2500). Chi scrive un valore nuovo non ha
-- nessun modo di sapere quale delle due, e sbagliando **non riceve
-- nessun errore**: riceve un numero piu' basso e credibile.
--
-- ⚠️ LA SOGLIA E' DICHIARATA, non nascosta: **zero, oppure almeno 1**.
-- Lo zero resta ammesso — «questa imposta non la pago» e' una risposta
-- legittima. Sotto l'1 non esiste nessuna aliquota IRES o IRAP italiana
-- (la piu' bassa mai vista e' l'IRAP agricola all'1,9%), quindi un valore
-- in quella fascia e' una frazione scritta al posto dei punti.
-- ⚠️ E il vincolo copre solo l'errore che si e' verificato: chi scrivesse
-- 2400 al posto di 24 passerebbe. Un vincolo che chiude un caso vero vale
-- piu' di uno che promette di chiuderli tutti.
--
-- ⚠️ QUESTA MIGRAZIONE MODIFICA RIGHE ESISTENTI, e lo dichiara: le
-- aliquote fra 0 e 1 esclusi vengono moltiplicate per 100. In produzione
-- tocca ZERO righe (i valori sono gia' in punti); sul progetto di prova
-- ne tocca una. La sanatoria stampa quante ne ha toccate — uno zero non
-- e' un errore, ma va detto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La sanatoria, col perimetro stretto e il conto dichiarato
-- ---------------------------------------------------------------------
do $sanatoria$
declare v_tocche integer;
begin
  with corrette as (
    update fiscal_settings
       set ires_rate = case when ires_rate > 0 and ires_rate < 1
                            then ires_rate * 100 else ires_rate end,
           irap_rate = case when irap_rate > 0 and irap_rate < 1
                            then irap_rate * 100 else irap_rate end,
           acconto_percento = case when acconto_percento > 0 and acconto_percento < 1
                                   then acconto_percento * 100 else acconto_percento end,
           acconto_prima_rata_percento = case when acconto_prima_rata_percento > 0
                                                and acconto_prima_rata_percento < 1
                                              then acconto_prima_rata_percento * 100
                                              else acconto_prima_rata_percento end
     where (ires_rate > 0 and ires_rate < 1)
        or (irap_rate > 0 and irap_rate < 1)
        or (acconto_percento > 0 and acconto_percento < 1)
        or (acconto_prima_rata_percento > 0 and acconto_prima_rata_percento < 1)
    returning 1
  )
  select count(*) into v_tocche from corrette;

  raise notice 'Aliquote riportate in punti percentuali: % riga/e.', v_tocche;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- 2. Il vincolo, che d'ora in poi respinge la frazione
-- ---------------------------------------------------------------------
alter table fiscal_settings drop constraint if exists fiscal_settings_aliquote_in_punti;
alter table fiscal_settings add constraint fiscal_settings_aliquote_in_punti check (
  (ires_rate = 0 or ires_rate >= 1)
  and (irap_rate = 0 or irap_rate >= 1)
  and (acconto_percento = 0 or acconto_percento >= 1)
  and (acconto_prima_rata_percento = 0 or acconto_prima_rata_percento >= 1)
);

comment on constraint fiscal_settings_aliquote_in_punti on fiscal_settings is
  'Le aliquote di questa tabella si scrivono in PUNTI percentuali (24 = 24%), non in frazione (0,24). Scritte in frazione sbagliavano di cento volte senza nessun errore, e sempre verso il basso. Zero resta ammesso.';

-- ---------------------------------------------------------------------
-- 3. Verifica — e prova che il vincolo DISCRIMINA, nei due versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_ires     numeric;
  v_irap     numeric;
  v_respinto boolean;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;

  -- (a) Nessuna riga viva e' rimasta in frazione. E' una PROPRIETA':
  --     resta vera anche su un database sano ma senza nessuna riga.
  if exists (
    select 1 from fiscal_settings
     where (ires_rate > 0 and ires_rate < 1)
        or (irap_rate > 0 and irap_rate < 1)
        or (acconto_percento > 0 and acconto_percento < 1)
        or (acconto_prima_rata_percento > 0 and acconto_prima_rata_percento < 1)
  ) then
    raise exception 'C''e'' ancora un''aliquota scritta in frazione: la sanatoria non ha fatto il suo lavoro.';
  end if;

  -- (b) Il vincolo respinge davvero. Si prova sul VALORE di una riga
  --     esistente, rimettendolo subito com'era: cosi' la verifica non
  --     crea righe da ripulire e non lascia lapidi.
  select entity_id, ires_rate, irap_rate into v_ente, v_ires, v_irap
    from fiscal_settings order by entity_id limit 1;

  if v_ente is null then
    raise notice 'Nessun parametro fiscale in questo database: il vincolo si prova alla prima scrittura.';
  else
    v_respinto := false;
    begin
      update fiscal_settings set ires_rate = 0.24 where entity_id = v_ente;
    exception when check_violation then
      v_respinto := true;
    end;

    if not v_respinto then
      update fiscal_settings set ires_rate = v_ires where entity_id = v_ente;
      raise exception 'Il vincolo NON ha respinto un''aliquota in frazione: e'' scritto ma non morde.';
    end if;

    -- Controprova del verso opposto: il valore legittimo deve passare.
    update fiscal_settings set ires_rate = v_ires, irap_rate = v_irap where entity_id = v_ente;
    if (select ires_rate from fiscal_settings where entity_id = v_ente) <> v_ires then
      raise exception 'La riga non e'' tornata al valore di prima.';
    end if;
  end if;

  -- (c) Nessuna lapide di prova nel registro delle cancellazioni.
  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %: questa verifica ha lasciato tracce.',
      v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Aliquote in punti: verificato. Il vincolo respinge la frazione e lascia passare il valore vero.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000002', 'l_aliquota_e_in_punti') on conflict (version) do nothing;
