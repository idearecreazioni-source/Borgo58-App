-- =====================================================================
-- LA SEGNALAZIONE PORTA LA SUA IMMAGINE — 28/10/2026
-- =====================================================================
-- Chiesto da Alessio il 28/10, dopo la sua prima segnalazione: «non
-- possiamo fare in modo che una segnalazione alleghi in automatico lo
-- screenshot dell'intera pagina da cui parte?». Aveva segnalato i pulsanti
-- storti della conferma «Elimina», e il testo salvato diceva quali parole
-- c'erano ma non che erano storte: per un difetto di aspetto il testo non
-- basta.
--
-- ⚠️ E' IL «PASSO A PARTE» annunciato dal quaderno (20261025000002): la
--    foto non entrava allora per non lasciare file da ripulire. Adesso il
--    file c'e', e segue le regole del deposito come le ricevute di MEMO:
--      · sta nel deposito «documents», che e' gia' solo del titolare
--        (20260910000003) — come le segnalazioni;
--      · PRIMA il file, POI la riga: una riga che nomina un file mai
--        caricato non si apre, un file senza riga lo trova
--        `npm run deposito:orfani` (che da oggi conosce questa colonna);
--      · il nome dipende da una chiave fatta una volta per segnalazione,
--        quindi riprovare non ne carica una seconda copia.
--
-- ⚠️ L'IMMAGINE NON SI RISCRIVE DOPO. Come testo e contesto, e' la
--    testimonianza di quel momento: il permesso di modificare resta su
--    stato ed esito soltanto.

alter table segnalazioni add column if not exists immagine_path text;

comment on column segnalazioni.immagine_path is
  'Dove sta, nel deposito «documents», l''immagine della pagina fatta dal gestionale nel momento in cui si e'' premuto «Segnala» (28/10/2026). E'' un ridisegno della pagina, non una foto dello schermo. Vuoto se l''immagine non si e'' potuta fare o e'' stata tolta prima di inviare.';

alter table segnalazioni drop constraint if exists segnalazione_immagine_al_suo_posto;
alter table segnalazioni add constraint segnalazione_immagine_al_suo_posto
  check (immagine_path is null
         or immagine_path ~ '^segnalazioni/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$');
comment on constraint segnalazione_immagine_al_suo_posto on segnalazioni is
  'L''immagine di una segnalazione sta nella cartella «segnalazioni» del deposito, con il nome che le da'' il gestionale.';

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_id       uuid;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  -- Si scrive nascendo, non si riscrive dopo.
  if not has_column_privilege('authenticated', 'segnalazioni', 'immagine_path', 'insert') then
    raise exception 'VERIFICA: il gestionale non puo'' allegare l''immagine a una segnalazione nuova.';
  end if;
  if has_column_privilege('authenticated', 'segnalazioni', 'immagine_path', 'update') then
    raise exception 'VERIFICA: l''immagine di una segnalazione si potrebbe riscrivere dopo.';
  end if;
  if has_column_privilege('anon', 'segnalazioni', 'immagine_path', 'select') then
    raise exception 'VERIFICA: l''immagine di una segnalazione e'' leggibile dagli anonimi.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Con l'immagine al suo posto nasce.
    insert into segnalazioni (testo, provenienza, immagine_path)
    values ('ZZ verifica: i pulsanti escono dallo schermo', 'pulsante',
            'segnalazioni/' || gen_random_uuid() || '.jpg')
    returning id into v_id;
    if (select immagine_path from segnalazioni where id = v_id) is null then
      raise exception 'VERIFICA (1): l''immagine non e'' rimasta attaccata alla segnalazione.';
    end if;

    -- (2) Un'immagine fuori dalla sua cartella si rifiuta: da qui non si
    --     nomina un documento qualunque del deposito.
    v_respinto := false;
    begin
      insert into segnalazioni (testo, provenienza, immagine_path)
      values ('ZZ verifica fuori posto', 'pulsante', 'da-collocare/' || gen_random_uuid() || '.jpg');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'VERIFICA (2): un''immagine fuori dalla cartella delle segnalazioni e'' passata.';
    end if;

    -- (3) Ne' un nome fatto a mano.
    v_respinto := false;
    begin
      insert into segnalazioni (testo, provenienza, immagine_path)
      values ('ZZ verifica nome a mano', 'pulsante', 'segnalazioni/../fatture/x.jpg');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then
      raise exception 'VERIFICA (3): un nome d''immagine fatto a mano e'' passato.';
    end if;

    -- (4) Senza immagine resta valida, come prima.
    insert into segnalazioni (testo, provenienza) values ('ZZ verifica senza immagine', 'pulsante');

    -- (5) Il vincolo nuovo ha la sua frase in italiano.
    if exists (select 1 from vincoli_senza_frase() v where v.tabella = 'segnalazioni') then
      raise exception 'VERIFICA (5): un vincolo del quaderno non ha la sua frase in italiano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''immagine delle segnalazioni');

  raise notice 'Fatto: una segnalazione puo'' portare l''immagine della pagina, solo nella sua cartella, e non la si riscrive dopo. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000004', 'la_segnalazione_porta_la_sua_immagine')
on conflict (version) do nothing;
