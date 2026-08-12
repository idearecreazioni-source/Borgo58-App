-- ---------------------------------------------------------------------
-- Una mail che non si riesce a leggere non si ripaga all'infinito
-- ---------------------------------------------------------------------
-- Guasto trovato in produzione stasera, 12/08/2026, sulla bolla di prova:
--
--   «lettura fallita: non ho capito la risposta della lettura
--    (motivo d'arresto: max_tokens)»
--
-- La risposta del modello è stata **troncata**. Nel pomeriggio ho
-- arricchito ciò che gli si chiede — l'importo di ogni riga, l'unità di
-- fatturazione, il fattore di conversione, il nome proposto per ogni
-- prodotto nuovo — e non ho alzato il tetto della risposta, fermo a
-- 4.000. Con nove righe non ci sta più.
--
-- ⚠️ È LA SECONDA VOLTA OGGI, per la stessa ragione: sta scritto in
-- `CLAUDE.md` §8 che una risposta troncata non è JSON e fallisce senza
-- dire perché. Allora il tetto era 400, l'ho portato a 4.000 e ho
-- considerato chiuso il problema. Non era chiuso: era spostato.
-- **Ogni volta che si chiede al modello di scrivere di più, il tetto va
-- rialzato nello stesso momento** — non è una precauzione, è parte della
-- modifica.
--
-- MA IL DIFETTO CHE QUESTA MIGRAZIONE CHIUDE È UN ALTRO, e più caro.
--
-- Una mail che fallisce resta `da_leggere` di proposito: se il guasto è
-- passeggero verrà ripresa, e se è permanente resta visibile invece di
-- sparire con una proposta inventata. Giusto. Solo che **viene ripresa
-- ogni quarto d'ora, per sempre, e ogni tentativo si paga.** Una mail che
-- il modello non digerirà mai — un PDF scritto male, un allegato enorme —
-- costa quattro letture all'ora finché qualcuno non se ne accorge. E
-- nessuno se ne accorge, perché il freno anti-tempesta degli avvisi ne
-- fa uscire uno solo all'ora.
--
-- Ora ogni fallimento si conta. Dopo tre tentativi la mail smette di
-- essere ripresa: resta in elenco con scritto cosa è successo, e la si
-- rimette in coda a mano quando si è capito il perché — che è il momento
-- giusto per riprovare, non «fra un quarto d'ora».
-- ---------------------------------------------------------------------

alter table posta_ricevuta
  add column if not exists tentativi_lettura integer not null default 0;

comment on column posta_ricevuta.tentativi_lettura is
  'Quante volte la lettura e'' fallita. Oltre il massimo la mail non viene piu'' ripresa: una mail illeggibile costerebbe quattro letture all''ora per sempre.';

-- ---------------------------------------------------------------------
-- Rimettere in coda una mail arresa
-- ---------------------------------------------------------------------
-- Il gesto è di Alessio e non del sistema: riprovare ha senso quando si è
-- capito *perché* era fallita, non allo scadere di un timer.
create or replace function riprova_lettura_posta(p_posta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' rimettere in coda una mail';
  end if;

  update posta_ricevuta
     set tentativi_lettura = 0,
         lettura_note = null,
         stato = 'da_leggere'
   where id = p_posta_id
     and stato in ('da_leggere', 'scartata');

  if not found then
    raise exception 'Questa mail non e'' in uno stato da cui si possa riprovare';
  end if;
end
$funzione$;

comment on function riprova_lettura_posta(uuid) is
  'Rimette in coda una mail che si era arresa dopo troppi tentativi. Lo decide Alessio: riprovare ha senso quando si e'' capito perche'' era fallita.';

revoke all on function riprova_lettura_posta(uuid) from public, anon;
grant execute on function riprova_lettura_posta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit  uuid;
  v_id   uuid;
  n      integer;
  v_tent integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare in user_roles.'; end if;

  -- 1. La colonna esiste e parte da zero.
  select count(*) into n from information_schema.columns
   where table_name = 'posta_ricevuta' and column_name = 'tentativi_lettura';
  if n <> 1 then raise exception 'Manca il conteggio dei tentativi.'; end if;

  insert into posta_ricevuta (messaggio_id, casella, oggetto, stato, tentativi_lettura, lettura_note)
  values ('PROVA-TENTATIVI-1', 'info@borgo58.it', 'prova', 'da_leggere', 3,
          'lettura fallita: prova')
  returning id into v_id;

  select tentativi_lettura into v_tent from posta_ricevuta where id = v_id;
  if v_tent <> 3 then raise exception 'Il conteggio non e'' stato conservato.'; end if;

  -- 2. Rimettere in coda azzera il conteggio e la nota.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform riprova_lettura_posta(v_id);

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  select tentativi_lettura into v_tent from posta_ricevuta where id = v_id;
  if v_tent <> 0 then
    raise exception 'Rimettere in coda non ha azzerato i tentativi (%).', v_tent;
  end if;

  select count(*) into n from posta_ricevuta where id = v_id and lettura_note is null;
  if n <> 1 then raise exception 'La nota del fallimento e'' rimasta.'; end if;

  -- 3. Pulizia (regola del 12/08).
  delete from posta_ricevuta where id = v_id;
  select count(*) into n from posta_ricevuta where messaggio_id = 'PROVA-TENTATIVI-1';
  if n <> 0 then raise exception 'La prova ha lasciato % mail.', n; end if;

  raise notice 'Tentativi di lettura: contati, e la mail si rimette in coda a mano.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000017', 'una_mail_non_si_ripaga_per_sempre')
on conflict (version) do nothing;

select count(*) filter (where tentativi_lettura > 0) as mail_con_tentativi_falliti,
       count(*) filter (where stato = 'da_leggere') as mail_in_coda
  from posta_ricevuta;
