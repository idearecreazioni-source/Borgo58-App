-- =====================================================================
-- I DUE LEGAMI DELLA CARTA PARLANO ITALIANO — 30/08/2026
-- =====================================================================
--
-- 🔴 TROVATO DA UNA PROVA SCRITTA IL 28/08, non da una rilettura.
-- `tests/app/vincoli-che-parlano.test.js` e' diventata rossa da sola
-- nominando i due colpevoli: `bar_items_ingredient_id_fkey` e
-- `order_items_bar_item_id_fkey`, cioe' le due chiavi esterne nate
-- stanotte col vino in magazzino.
--
-- ⚠️ E LA REGOLA E' PIU' LARGA DI COME ME LA RICORDAVO: il 25/08 riguardava
-- i vincoli `check`, e il **28/08 e' stata allargata** a unicita' e chiavi
-- esterne — che sono forme che il gestionale sa tradurre. Un legame senza
-- frase risponde a schermo «violates foreign key constraint», che in sala
-- non e' un rifiuto: e' un guasto.
--
-- ⚠️ NON SI RISCRIVE LA MIGRAZIONE DI STANOTTE (regola del 23/08): quella
-- e' gia' applicata, e racconta cosa e' successo. Si aggiunge.

comment on constraint bar_items_ingredient_id_fkey on bar_items is
  'Questa voce della carta punta a un prodotto del magazzino che non esiste piu''. Se il prodotto e'' stato tolto, scegline un altro dalla carta — oppure lascia la voce senza prodotto: non scarichera'' la cantina, e la schermata lo dice.';

comment on constraint order_items_bar_item_id_fkey on order_items is
  'Questa riga del conto e'' agganciata a una voce della carta che non c''e'' piu''. Una voce della carta non si cancella: si mette fuori carta, cosi'' i conti gia'' chiusi restano leggibili.';

do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_mute  text;
  v_n     integer;
  v_tit   uuid;
begin
  -- ⚠️ `vincoli_senza_frase()` ha un portiere, e dentro una migrazione non
  --    c'e' nessun utente: si impersona il titolare come fanno le altre
  --    verifiche, e si rimette a posto in fondo.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Manca il titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  -- (1) I DUE NOMINATI DALLA PROVA HANNO LA LORO FRASE.
  select string_agg(c.conname, ', ' order by c.conname) into v_mute
    from pg_constraint c
   where c.conname in ('bar_items_ingredient_id_fkey', 'order_items_bar_item_id_fkey')
     and obj_description(c.oid, 'pg_constraint') is null;
  if v_mute is not null then
    raise exception 'Questi legami sono ancora muti: %.', v_mute;
  end if;

  -- (2) E LA PROPRIETA' GENERALE: nessun vincolo muto fuori dall'elenco
  --     congelato. E' la stessa domanda che fa la prova, chiesta qui — se
  --     domani ne nascesse un altro, questa migrazione riapplicata lo
  --     direbbe.
  select count(*) into v_n from vincoli_senza_frase();
  if v_n > 0 then
    raise exception 'Ci sono % vincoli senza spiegazione in italiano.', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei due legami della carta');
  raise notice 'Fatto: i due legami della carta rispondono in italiano. Vincoli muti fuori elenco: %.', v_n;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000006', 'i_due_legami_della_carta_parlano_italiano') on conflict (version) do nothing;
