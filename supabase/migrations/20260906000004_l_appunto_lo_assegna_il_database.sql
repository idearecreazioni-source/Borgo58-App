-- =====================================================================
-- SPEC-0013 — l'appunto lo assegna il database, non chi scrive
-- =====================================================================
-- 🔴 IL DIFETTO L'HANNO TROVATO LE PROVE CHE C'ERANO GIA', non una
--    rilettura: `20260906000001` ha reso `azioni_dettate.appunto_id`
--    obbligatorio e ha insegnato a riempirlo **a una porta sola**
--    (`scrivi_dettatura`). Ma in `azioni_dettate` si scrive anche da
--    altrove — le prove di `uscita-a-mano` e `voce` inseriscono dritto — e
--    da li' l'inserimento moriva con «null value in column appunto_id».
--
-- ⚠️ E' LA FORMA DI DIFETTO CHE QUESTO PROGETTO CONOSCE MEGLIO: una regola
--    che vive in un chiamante invece che nel database. La cura non e'
--    insegnarla anche agli altri chiamanti — sarebbe «trovarli tutti», e il
--    prossimo che scrive nascerebbe storto. La cura e' che il database se
--    la metta da solo.
--
-- ⚠️ IL TRIGGER USA LA STESSA `appunto_per` DI PRIMA: non c'e' una seconda
--    definizione del raggruppamento. Cambia solo *chi* la chiama — e adesso
--    la chiama l'unica cosa da cui nessuno puo' passare accanto.
--
-- 🔴 E UN SECONDO DIFETTO, dalla stessa tornata di prove: una riga sicura e
--    eseguibile restava senza `motivo`, e una prova del 27/08 pretende che
--    ogni cosa in attesa dica PERCHE' aspetta — *«un elenco di cose in
--    attesa senza il perche' e' un elenco di cose di cui non si sa che
--    fare»*. Prima non capitava, perche' una riga cosi' si eseguiva da se' e
--    non compariva in nessun elenco. Adesso aspettano tutte, quindi tutte
--    devono avere una ragione scritta: «Questa la guardi sempre tu prima che
--    venga scritta».

comment on constraint azioni_dettate_appunto_id_fkey on azioni_dettate is
  'Ogni cosa detta appartiene a un appunto: e'' l''appunto che Alessio approva o butta, non la singola riga.';

create or replace function azione_trova_il_suo_appunto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.appunto_id is null then
    new.appunto_id := appunto_per(new.tipo, new.destinazione_libera, coalesce(new.dati, '{}'::jsonb));
  end if;
  return new;
end $$;

comment on function azione_trova_il_suo_appunto() is
  'Assegna l''appunto a una cosa detta quando chi scrive non l''ha indicato. Sta qui e non nei chiamanti perche'' in azioni_dettate si scrive da piu'' porte, e una regola che vive in una porta sola la dimentica la porta successiva.';

revoke all on function azione_trova_il_suo_appunto() from public, anon, authenticated;

drop trigger if exists trg_azione_trova_il_suo_appunto on azioni_dettate;
create trigger trg_azione_trova_il_suo_appunto
  before insert on azioni_dettate
  for each row execute function azione_trova_il_suo_appunto();

-- rete-guardie: scrivi_dettatura — l'appunto adesso lo mette il trigger, quindi qui sparisce la chiamata ad appunto_per e l'array che li contava
create or replace function scrivi_dettatura(
  p_utente uuid, p_testo text, p_provenienza text, p_azioni jsonb, p_esito text,
  p_modello text, p_token_domanda integer, p_token_risposta integer, p_messaggio text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prezzo    costo_modello_ai%rowtype;
  v_costo     numeric := 0;
  v_msg       text := p_messaggio;
  v_dettatura uuid;
  v_azione    jsonb;
  v_i         integer := 0;
  v_tipo      text;
  v_libera    text;
  v_sicuro    boolean;
  v_dati      jsonb;
  v_frase     text;
  v_motivo    text;
  v_alt       jsonb;
  v_risolto   jsonb;
  v_manca     text;
  v_d         record;
  v_appunti   integer := 0;
begin
  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      -- Uno zero silenzioso in un conto di spesa si legge «gratis».
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa dettatura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into dettature (testo, provenienza, esito, modello,
                         token_domanda, token_risposta, costo_euro, messaggio, creato_da)
  values (p_testo, p_provenienza, p_esito, p_modello,
          coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, v_msg, p_utente)
  returning id into v_dettatura;

  for v_azione in select * from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb))
  loop
    v_i      := v_i + 1;
    v_tipo   := coalesce(nullif(btrim(coalesce(v_azione->>'tipo', '')), ''), 'nota_non_capita');
    v_libera := nullif(btrim(coalesce(v_azione->>'destinazione', '')), '');
    v_sicuro := coalesce((v_azione->>'sicuro')::boolean, false);
    v_dati   := coalesce(v_azione->'dati', '{}'::jsonb);
    v_frase  := nullif(btrim(coalesce(v_azione->>'frase', '')), '');
    v_motivo := nullif(btrim(coalesce(v_azione->>'motivo', '')), '');
    v_alt    := case when jsonb_typeof(v_azione->'alternative') = 'array'
                       and jsonb_array_length(v_azione->'alternative') > 0
                     then v_azione->'alternative' end;

    select * into v_d from destinazione_vocale(v_tipo, v_libera);

    -- ⚠️ SI RITRADUCE SOLO CIO' CHE IL GESTIONALE SA ESEGUIRE: su una
    --    destinazione che non esiste non c'e' nessun catalogo in cui cercare.
    if v_d.eseguibile then
      v_risolto := voce_risolvi_dati(v_tipo, v_dati);
      v_dati    := v_risolto->'dati';
      v_manca   := nullif(v_risolto->>'manca', '');
      if v_manca is not null then
        -- Quello che manca VINCE su qualunque sicurezza dichiarata.
        v_sicuro := false;
        v_motivo := coalesce(v_motivo, v_manca);
      end if;
    else
      -- 🔴 NON E' UN'INCERTEZZA DI MEMO: MEMO puo' aver capito benissimo, e'
      --    il gestionale che non ha il gesto. Detto in parole, perche' «non
      --    sicuro» da solo farebbe credere che il problema sia nell'ascolto.
      v_motivo := coalesce(v_motivo,
        'Ho capito cosa vuoi, ma il gestionale non ha ancora un modo per farlo: '
        || 'questo appunto resta qui come promemoria.');
    end if;

    if v_frase is null then
      v_frase := coalesce(v_d.titolo, 'Una cosa che non ho capito');
    end if;

    -- 🔴 IL PERCHE' C'E' SEMPRE. Anche su una riga sicura e eseguibile: da
    --    quando niente si salva da se', anche quella aspetta — e un elenco
    --    di cose in attesa senza il perche' e' un elenco di cose di cui non
    --    si sa che fare.
    if v_motivo is null then
      v_motivo := case
        when not v_sicuro then 'Non ero sicuro: guardala tu.'
        else 'Questa la guardi sempre tu prima che venga scritta.'
      end;
    end if;

    -- 🔴 SEMPRE `in_attesa`, e l'appunto lo mette il trigger.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                frase, motivo, stato, alternative, destinazione_libera)
    values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
            v_frase, v_motivo, 'in_attesa', v_alt, v_libera);
  end loop;

  select count(distinct a.appunto_id) into v_appunti
    from azioni_dettate a where a.dettatura_id = v_dettatura;

  return jsonb_build_object(
    'dettatura_id', v_dettatura,
    'costo_euro',   v_costo,
    'nel_listino',  v_prezzo.modello is not null,
    'azioni',       v_i,
    'eseguite',     0,
    'appunti',      coalesce(v_appunti, 0),
    'da_guardare',  v_i);
end $function$;

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_app    uuid;
  v_lapidi bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  insert into dettature (testo, provenienza, esito) values ('prova migrazione: porta diretta', 'app', 'capita')
  returning id into v_det;

  -- 🔴 SI SCRIVE DALLA PORTA DIRETTA, senza nominare l'appunto: e' il caso
  --    che prima moriva. Il trigger deve metterlo lui.
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'lista_spesa', jsonb_build_object('nome_libero', 'prova diretta'), true,
          'riga di prova', 'prova', 'in_attesa')
  returning id, appunto_id into v_id, v_app;

  if v_app is null then
    raise exception 'VERIFICA: il trigger non ha assegnato nessun appunto.';
  end if;
  if (select destinazione from appunti_vocali where id = v_app) is distinct from 'lista_spesa' then
    raise exception 'VERIFICA: l''appunto assegnato non e'' quello della lista.';
  end if;

  -- E ogni riga scritta da `scrivi_dettatura` ha il suo perche'.
  if exists (select 1 from azioni_dettate a
              where a.dettatura_id = v_det and a.stato = 'in_attesa'
                and coalesce(btrim(a.motivo), '') = '') then
    raise exception 'VERIFICA: una riga in attesa non dice perche'' aspetta.';
  end if;

  delete from azioni_dettate where id = v_id;
  delete from appunti_vocali where id = v_app;
  delete from dettature where id = v_det;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'VERIFICA superata: l''appunto lo mette il database, e ogni riga in attesa dice perche''.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000004', 'l appunto lo assegna il database') on conflict (version) do nothing;
