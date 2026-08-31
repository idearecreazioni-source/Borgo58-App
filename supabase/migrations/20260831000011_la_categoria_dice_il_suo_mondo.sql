-- =====================================================================
-- IL MENU DELLE CATEGORIE DICE IN CHE MONDO SI FINISCE — 31/08/2026
-- =====================================================================
--
-- 🔴 TROVATO GUARDANDO, subito dopo aver spostato «Dolce e da meditazione»
-- dai vini ai liquori. Aperta la scheda di un prodotto, il menu delle
-- categorie mostra **ventiquattro voci piatte**: Verdura, Frutta, … Bevande,
-- Rosso, Bianco, Rosato, Bollicine, Amari, Distillati, Liquori dolci, Dolce
-- e da meditazione, Altro.
--
-- ⚠️ **L'ordine era giusto** — lo spostamento si vedeva, «Dolce e da
-- meditazione» compariva dopo «Liquori dolci». Ma **il mondo no**: chi
-- sceglie una categoria non sa in quale dei sette mondi finira' il prodotto,
-- e i mondi sono precisamente il modo in cui il Magazzino si divide da
-- stamattina.
--
-- ⚠️ E' la stessa famiglia dei giorni scorsi, in una forma piu' sottile: il
-- dato **esiste** (`categorie_ingrediente.mondo`), **decide** dove il
-- prodotto comparira' — e la schermata dove lo si sceglie **non lo dice**.
-- Non e' un errore che il gestionale segnala: e' un prodotto che finisce nel
-- mondo sbagliato senza che nessuno se ne accorga.
--
-- ⚠️ IL CORPO E' PRESO DAL DATABASE VIVO (regola del 18/08). Cambia solo:
-- una colonna in piu' in fondo. E la colonna va **in fondo** perche' chi
-- legge il risultato per posizione non si sposti.

-- ⚠️ SI DROPPA PRIMA, e non e' una scelta: cambiare le colonne che una
--    funzione restituisce non si puo' fare con `create or replace` — Postgres
--    lo rifiuta («cannot change return type»). Scoperto applicando.
-- ⚠️ E dopo un `drop` i permessi tornano aperti al mondo: si richiudono a
--    mano piu' sotto, e la verifica lo controlla invece di darlo per fatto.
drop function if exists categorie_proponibili(text);

create or replace function categorie_proponibili(p_ambito text default 'alimenti'::text)
returns table (codice text, nome text, ordine integer, mondo text, mondo_nome text)
language sql
stable
set search_path = public
as $function$
  select c.codice, c.nome, c.ordine,
         -- 🔴 IL MONDO, e il suo nome leggibile: la schermata deve poter
         --    raggruppare senza chiedere una seconda volta. Un secondo giro
         --    per una cosa che sta nella stessa riga e' un secondo posto
         --    dove quella risposta puo' divergere.
         c.mondo, m.nome
    from categorie_ingrediente c
    left join mondi_magazzino m on m.codice = c.mondo
   where c.attiva
     and (c.ambito = 'entrambi' or c.ambito = coalesce(nullif(btrim(p_ambito), ''), 'alimenti'))
   -- ⚠️ L'ordine e' quello dei MONDI e poi quello delle categorie dentro:
   --    cosi' il menu raggruppato esce gia' ordinato come Alessio ha deciso,
   --    e la schermata non deve riordinare niente per conto suo.
   order by m.ordine nulls last, c.ordine, c.nome;
$function$;

comment on function categorie_proponibili is
  'Le categorie che si possono scegliere, col MONDO a cui appartengono. '
  '⚠️ Il mondo esce da qui e non da una seconda interrogazione: due posti per '
  'la stessa risposta prima o poi si contraddicono.';

revoke all on function categorie_proponibili(text) from public, anon, authenticated;
grant execute on function categorie_proponibili(text) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_n integer; v_senza integer; v_mondo text; v_primo text;
begin
  select count(*) into v_n from categorie_proponibili('alimenti');
  if v_n = 0 then
    raise exception 'Nessuna categoria proponibile: il setaccio e'' rotto';
  end if;

  -- (1) OGNI riga dichiara il suo mondo. Se una lo lasciasse vuoto, il menu
  --     raggruppato la perderebbe **senza dirlo**.
  select count(*) into v_senza from categorie_proponibili('alimenti') where mondo is null;
  if v_senza <> 0 then
    raise exception '% categorie non dicono in che mondo stanno', v_senza;
  end if;

  -- (2) E la categoria appena spostata dice il mondo NUOVO: e' il caso da
  --     cui questa migrazione nasce.
  select mondo into v_mondo from categorie_proponibili('alimenti') where codice = 'vino_dolce';
  -- ⚠️ `is distinct from` e non `<>`: contro un valore che puo' essere vuoto
  --    un `<>` vale NULL e l'if non entra — approverebbe la rottura.
  if v_mondo is distinct from 'liquori' then
    raise exception '«Dolce e da meditazione» dice di stare in «%»',
      coalesce(v_mondo, '(vuoto)');
  end if;

  -- (3) L'ORDINE parte dal primo mondo, non dalla prima categoria in
  --     ordine alfabetico: e' cio' che permette al menu di uscire gia'
  --     raggruppato come Alessio ha deciso.
  select mondo into v_primo from categorie_proponibili('alimenti') limit 1;
  if v_primo is distinct from 'alimentari' then
    raise exception 'Il primo mondo dell''elenco e'' «%», doveva essere «alimentari»',
      coalesce(v_primo, '(vuoto)');
  end if;

  -- (4) LA PORTA E' RICHIUSA dopo il drop: un `drop` riapre i permessi al
  --     mondo, e una funzione riaperta non da' nessun errore — si vede solo
  --     contandola fra quelle che chiunque puo' chiamare.
  if has_function_privilege('anon', 'categorie_proponibili(text)', 'execute') then
    raise exception 'Dopo il drop la funzione e'' rimasta aperta ad anon';
  end if;

  raise notice 'Fatto: % categorie, tutte col loro mondo, ordinate per mondo.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000011', 'la_categoria_dice_il_suo_mondo') on conflict (version) do nothing;
