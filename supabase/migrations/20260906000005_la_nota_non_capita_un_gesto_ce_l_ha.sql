-- =====================================================================
-- SPEC-0013 — «non ho capito» un gesto ce l'ha
-- =====================================================================
-- 🔴 ERRORE MIO, e la forma e' quella che questo progetto insegue da
--    settimane: in `20260906000001` ho scritto che `nota_non_capita` «non e'
--    eseguibile e non lo e' mai stata», con l'aria di un fatto. **Non
--    l'avevo misurato.** Un gesto ce l'ha, ed esiste dal 26/08: approvarla
--    crea un impegno in Agenda con dentro la frase che non si era capita —
--    che e' esattamente il modo in cui quella frase non va persa.
--
-- ⚠️ IL DANNO CHE AVREBBE FATTO: marcandola non eseguibile, l'appunto
--    «non ho capito» diventava **impossibile da approvare** — l'unica
--    uscita sarebbe stata buttarlo. Cioe' il gestionale avrebbe perso
--    proprio le frasi che aveva capito di meno, che sono quelle che vale
--    di piu' conservare.
--
-- ⚠️ E NESSUNA VERIFICA DELLE MIGRAZIONI L'AVREBBE PRESO: le tre verifiche
--    scritte quel giorno provavano il caso della destinazione **libera**,
--    che non e' eseguibile per davvero. A trovarlo e' stata una prova del
--    27/08 che pretende che una nota diventi un impegno — cioe' un
--    guardiano scritto per un'altra ragione, dieci giorni prima.

update tipi_azione_vocale set eseguibile = true where tipo = 'nota_non_capita';

do $verifica$
declare
  v_ok boolean;
begin
  select eseguibile into v_ok from tipi_azione_vocale where tipo = 'nota_non_capita';
  if v_ok is distinct from true then
    raise exception 'VERIFICA: «non ho capito» risulta ancora senza gesto.';
  end if;

  -- ⚠️ E lo si chiede alla funzione che decide, non alla tabella: e' quella
  --    che l'appunto interroga, e se un giorno leggesse altrove le due
  --    risposte potrebbero divergere.
  select d.eseguibile into v_ok from destinazione_vocale('nota_non_capita', null) d;
  if v_ok is distinct from true then
    raise exception 'VERIFICA: la funzione dice ancora che non si puo'' eseguire.';
  end if;

  -- La destinazione inventata invece resta non eseguibile: il caso vero.
  select d.eseguibile into v_ok from destinazione_vocale('zzz_non_esiste_davvero', 'Una cosa') d;
  if v_ok is distinct from false then
    raise exception 'VERIFICA: una destinazione sconosciuta risulta eseguibile.';
  end if;

  raise notice 'VERIFICA superata: «non ho capito» si puo'' approvare, una destinazione inventata no.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000005', 'la nota non capita un gesto ce l ha') on conflict (version) do nothing;
