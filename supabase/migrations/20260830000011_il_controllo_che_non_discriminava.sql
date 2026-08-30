-- =====================================================================
-- IL CONTROLLO CHE NON DISCRIMINAVA — 30/08/2026
-- =====================================================================
--
-- 🔴 TROVATO ROMPENDO, non rileggendo. La verifica della `20260830000010`
-- ha tre controlli, e il terzo doveva dire: *«due parole in comune bastano,
-- anche se nessuna delle due identifica da sola»*. Rompendo la regola nel
-- modo che quel controllo esiste per prendere — pretendere **sempre** una
-- parola rara — **la verifica è rimasta verde**.
--
-- IL PERCHÉ, ed è la trappola del 27/08: *un esempio costruito prova solo i
-- casi che gli hai messo dentro*. La voce di prova era «zzverde due
-- bottiglia» e il prodotto «ZZ zzverde due»: le parole in comune erano
-- «zzverde» (in tre prodotti) **e «due»** — che stava in **un prodotto
-- solo**. Quindi l'esempio conteneva per caso proprio la parola rara che il
-- controllo doveva escludere, e passava per la ragione sbagliata.
--
-- ⚠️ NON SI RISCRIVE LA `20260830000010` (regola del 23/08): racconta cosa è
-- successo, e la versione buona del controllo sta qui, con roba propria.
--
-- ⚠️ E LA REGOLA NON CAMBIA: cambia solo l'esempio con cui la si mette alla
-- prova. Adesso i due prodotti condividono **due parole comuni e nessuna
-- rara**, che è l'unico caso in cui le due risposte si separano.

do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_ent  uuid;
  v_tit  uuid;
  v_n    integer;
begin
  select id into v_ent from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_ent is null or v_tit is null then
    raise exception 'Manca la societa'' o il titolare: impossibile verificare.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- 🔴 TRE prodotti che condividono ENTRAMBE le parole: cosi' nessuna
    --    delle due identifica un prodotto solo, e l'unica cosa che puo'
    --    far passare la proposta e' la QUANTITA'.
    insert into ingredients (name, category, unit, current_price, entity_id, alimentare, tenuto_in_magazzino)
    values ('ZZ zzalfa zzbeta uno', 'verdura', 'kg', 1, v_ent, true, true),
           ('ZZ zzalfa zzbeta due', 'verdura', 'kg', 1, v_ent, true, true),
           ('ZZ zzalfa zzbeta tre', 'verdura', 'kg', 1, v_ent, true, true);

    -- ⚠️ La voce non contiene NESSUNA parola rara: «zzalfa» e «zzbeta»
    --    stanno tutt'e due in tre prodotti. E' il caso che separa le due
    --    risposte.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'ZZ prova', 'zzalfa zzbeta', 'Bottiglia', 10);

    select count(*) into v_n from abbinamenti_carta_proposti() where voce = 'zzalfa zzbeta';
    if v_n <> 3 then
      raise exception 'Con due parole in comune e NESSUNA rara escono % proposte invece di 3: la quantita'' non conta piu''.', v_n;
    end if;

    -- E il verso opposto, sullo stesso esempio: una parola sola di quelle
    -- due non deve bastare. Senza, una regola che accettasse tutto
    -- passerebbe il controllo qui sopra.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'ZZ prova', 'zzalfa soltanto', 'Bottiglia', 10);
    select count(*) into v_n from abbinamenti_carta_proposti() where voce = 'zzalfa soltanto';
    if v_n <> 0 then
      raise exception 'Con una parola comune sola escono % proposte: doveva non uscirne nessuna.', v_n;
    end if;

    raise exception 'ZZ_ANNULLA' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);

  select count(*) into v_n from ingredients where name like 'ZZ zzalfa%';
  if v_n > 0 then raise exception 'Sono rimasti % prodotti: l''annullamento non ha funzionato.', v_n; end if;
  select count(*) into v_n from pg_trigger t where t.tgenabled = 'D' and not t.tgisinternal;
  if v_n > 0 then raise exception '% trigger sono spenti.', v_n; end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica che adesso discrimina');
  raise notice 'Fatto: due parole comuni bastano, una sola no — provato su un esempio senza nessuna parola rara.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000011', 'il_controllo_che_non_discriminava') on conflict (version) do nothing;
