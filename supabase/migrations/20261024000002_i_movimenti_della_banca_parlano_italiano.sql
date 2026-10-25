-- =====================================================================
-- I MOVIMENTI DELLA BANCA PARLANO ITALIANO — 24/10/2026
-- =====================================================================
--
-- 🔴 LO HA TROVATO LA RETE, NON UNA RILETTURA. La `20261024000001` ha
-- dato la frase italiana ai tre vincoli `check` di `movimenti_banca`, e
-- ha lasciato mute le altre tre forme che la tabella porta: l'unicita'
-- (conto + impronta), l'unicita' del movimento di cassa collegato e la
-- chiave esterna verso il conto. `tests/app/vincoli-che-parlano.test.js`
-- e' diventata rossa sul progetto di prova appena la migrazione e'
-- entrata: dal 28/08 `vincoli_senza_frase()` guarda anche unicita' e
-- chiavi esterne, e la verifica della migrazione no.
--
-- ⚠️ La `…001` e' gia' applicata sul progetto di prova, quindi non si
-- corregge: la frase arriva da qui (regola del 23/08).
-- =====================================================================

comment on constraint movimenti_banca_conto_id_impronta_key on movimenti_banca is
  'Questo movimento della banca e'' gia'' stato caricato: lo stesso estratto, o uno che si sovrappone, non lo fa entrare due volte.';

comment on constraint movimenti_banca_cash_movement_id_key on movimenti_banca is
  'Questo movimento della prima nota e'' gia'' abbinato a un altro movimento della banca. Sciogli quell''abbinamento prima di farne uno nuovo.';

comment on constraint movimenti_banca_conto_id_fkey on movimenti_banca is
  'Il conto corrente di questo movimento non c''e'' piu'', oppure ha ancora movimenti della banca: un conto con dei movimenti caricati non si toglie.';

-- ⚠️ La quarta non era nell'elenco della rete: l'ha trovata la verifica
-- qui sotto, che guarda tutte le chiavi esterne della tabella. Il
-- movimento di cassa collegato non si cancella da qui (il collegamento si
-- scioglie da solo, `on delete set null`), ma una frase in piu' non costa.
comment on constraint movimenti_banca_cash_movement_id_fkey on movimenti_banca is
  'Il movimento della prima nota collegato a questo movimento della banca non c''e''.';

-- ---------------------------------------------------------------------
-- Verifica: nessun vincolo di movimenti_banca resta senza frase.
-- ⚠️ Si legge il catalogo e non `vincoli_senza_frase()`: quella ha il
-- portiere, e una migrazione non ha un utente.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_muti text;
begin
  select string_agg(c.conname, ', ' order by c.conname) into v_muti
  from pg_constraint c
  where c.conrelid = 'public.movimenti_banca'::regclass
    and c.contype in ('c', 'u', 'f')
    and coalesce(obj_description(c.oid, 'pg_constraint'), '') = '';
  if v_muti is not null then
    raise exception 'VERIFICA: vincoli di movimenti_banca ancora senza frase italiana: %', v_muti;
  end if;

  raise notice 'Fatto: i sette vincoli dei movimenti della banca hanno tutti la loro frase in italiano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261024000002', 'i_movimenti_della_banca_parlano_italiano')
on conflict (version) do nothing;
