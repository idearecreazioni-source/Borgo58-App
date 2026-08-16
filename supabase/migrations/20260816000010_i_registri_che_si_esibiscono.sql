-- =====================================================================
-- I registri che si esibiscono
-- =====================================================================
-- Blocco 6 del mandato di correzione (16/08/2026). Quattro rilievi che
-- hanno in comune il destinatario: **non Alessio, ma chi verrà a
-- controllare** — un ispettore, la commercialista, un domani il fisco.
-- Un registro che si esibisce non può contenere una riga che dichiara
-- qualcosa che non è avvenuto.
--
-- 6.1 — LA NON CONFORMITÀ CHE SI CHIUDE SENZA DIRE COSA HAI FATTO.
-- Il registro temperature e il ricevimento merci promettono, testuale:
-- *«resta APERTA finché non scrivi cosa hai fatto»*. Ma si premeva
-- «Conferma risoluzione» col campo vuoto e si chiudeva: **il vincolo del
-- database chiedeva solo la data**. Nel manuale esibibile quella riga
-- compare come «risolta» senza azione correttiva — davanti a un ispettore
-- è **peggio di una non conformità ancora aperta**, perché dichiara un
-- rimedio che non c'è.
--
-- ⚠️ LA PROMESSA NON PUÒ VIVERE SOLO NEI MESSAGGI. La cura è in due posti,
-- e quello che conta è il secondo: campo obbligatorio nella schermata E
-- vincolo nel database. Il primo aiuta chi lavora, il secondo è ciò che
-- rende vera la frase.
--
-- ⚠️ E NON si allarga al momento della registrazione. Dal 13/08 una
-- lettura fuori range apre da sé una non conformità e **non blocca il
-- salvataggio**, apposta: davanti a un campo obbligatorio, di sera, uno
-- non scrive il rimedio — non registra la misurazione, e una misurazione
-- persa è irrecuperabile. Qui si vincola solo la CHIUSURA, che è un gesto
-- che si fa con calma.
--
-- 6.2 e 6.3 — IL REGISTRO CANCELLABILE, E LE TABELLE FUORI DAL REGISTRO.
-- `foraged_items` (raccolta propria) è l'unico registro HACCP
-- cancellabile dall'interfaccia, a un tocco e senza traccia. E quattro
-- tabelle di soldi e di documenti stanno fuori da `deleted_records`:
-- `anticipazioni_socio`, `conteggi_cassa`, `deductible_expenses`,
-- `foraged_items`. (`order_items` è entrata col Blocco 4.)
--
-- 6.4 — IL NUMERO DELLA FATTURA. `orders_documento_coerente` chiede la
-- data, non il numero: si premeva «Fattura fatta» col campo vuoto. Una
-- fattura senza numero non è una fattura — è una riga che dice di esserlo.
--
-- ⚠️ Stato di partenza VERO, letto col connettore prima di scrivere: zero
-- non conformità (aperte e risolte), zero raccolte proprie, zero conti
-- con «fattura» e numero vuoto. **Nessun vincolo ha bisogno di una
-- sanatoria**, e nessuna riga esistente diventa illegale. Se ce ne fosse
-- stata una, un `check` aggiunto così l'avrebbe resa immodificabile per
-- sempre — e il rimedio giusto sarebbe stato un altro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Una non conformità non si chiude senza dire cosa è stato fatto
-- ---------------------------------------------------------------------
alter table haccp_non_conformities
  drop constraint if exists nc_risolta_ha_rimedio;

alter table haccp_non_conformities
  add constraint nc_risolta_ha_rimedio
  check (not resolved or coalesce(btrim(corrective_action), '') <> '');

comment on constraint nc_risolta_ha_rimedio on haccp_non_conformities is
  'Una non conformita'' RISOLTA deve dire cosa e'' stato fatto (16/08/2026, Blocco 6). La schermata lo prometteva — «resta aperta finche'' non scrivi cosa hai fatto» — e il database chiedeva solo la data: nel manuale esibibile quella riga compariva come risolta senza rimedio, che davanti a un ispettore e'' peggio di una ancora aperta. Il vincolo NON tocca la registrazione: una lettura fuori range si salva sempre, perche'' una misurazione persa e'' irrecuperabile.';

-- ---------------------------------------------------------------------
-- 2. Una fattura senza numero non è una fattura
-- ---------------------------------------------------------------------
alter table orders
  drop constraint if exists orders_documento_coerente;

alter table orders
  add constraint orders_documento_coerente
  check (
    documento_fiscale is distinct from 'fattura'
    or (documento_emesso_il is not null
        and coalesce(btrim(documento_numero), '') <> '')
  );

comment on constraint orders_documento_coerente on orders is
  'Un conto dichiarato «fattura» deve avere data E NUMERO (numero aggiunto il 16/08/2026, Blocco 6). Senza numero non e'' una fattura: e'' una riga che dice di esserlo, e sparisce dall''elenco dei conti da sistemare portandosi via la differenza fra incassato e fiscalizzato.';

-- ---------------------------------------------------------------------
-- 3. Le tabelle di soldi e di documenti entrano nel registro
-- ---------------------------------------------------------------------
-- ⚠️ Su `foraged_items` il registro non basta da solo: la conferma nella
-- schermata arriva col commit di questo blocco. Ma la traccia e' la parte
-- che non si puo' aggirare — una cancellazione fatta da un altro tablet,
-- o dritto dal browser, resta scritta lo stesso.
do $$
declare
  t text;
begin
  foreach t in array array[
    'anticipazioni_socio', 'conteggi_cassa', 'deductible_expenses', 'foraged_items'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise exception 'La tabella % non esiste: elenco da correggere.', t;
    end if;
    execute format('drop trigger if exists trg_log_delete on %I;', t);
    execute format(
      'create trigger trg_log_delete before delete on %I for each row execute function log_deleted_record();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno; perimetro fatto solo
-- di roba creata qui.
do $verifica$
declare
  v_titolare uuid;
  e1 uuid; v_tag uuid;
  v_nc uuid; v_rac uuid; v_ant uuid; v_conto uuid;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;

  -- ===== 6.1 — la non conformità =====
  insert into haccp_non_conformities (category, description, detected_at)
  values ('temperatura', '__Prova B6__', now()) returning id into v_nc;

  -- Chiuderla senza dire cosa si è fatto: respinto.
  respinto := false;
  begin
    update haccp_non_conformities
       set resolved = true, resolved_at = now()
     where id = v_nc;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then
    raise exception 'Una non conformita'' si e'' chiusa senza rimedio: nel manuale esibibile risulterebbe risolta.';
  end if;

  -- Uno spazio bianco non è un rimedio.
  respinto := false;
  begin
    update haccp_non_conformities
       set resolved = true, resolved_at = now(), corrective_action = '   '
     where id = v_nc;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then
    raise exception 'Uno spazio bianco e'' passato come azione correttiva.';
  end if;

  -- Col rimedio scritto, si chiude.
  update haccp_non_conformities
     set resolved = true, resolved_at = now(),
         corrective_action = 'Merce respinta e fornitore avvisato'
   where id = v_nc;
  if not (select resolved from haccp_non_conformities where id = v_nc) then
    raise exception 'Una non conformita'' col rimedio scritto non si e'' chiusa.';
  end if;

  -- ⚠️ E APRIRNE UNA NUOVA resta libero: il vincolo non deve aver
  -- toccato la registrazione. Una misurazione fuori range va salvata
  -- sempre — di sera, davanti a un campo obbligatorio, non si scrive il
  -- rimedio: si smette di registrare.
  insert into haccp_non_conformities (category, description, detected_at)
  values ('ricevimento', '__Prova B6 aperta__', now());
  if not exists (select 1 from haccp_non_conformities
                  where description = '__Prova B6 aperta__' and not resolved) then
    raise exception 'Non si riesce piu'' ad aprire una non conformita'' senza rimedio.';
  end if;

  -- ===== 6.4 — il numero della fattura =====
  insert into orders (table_label, status, coperti, coperto_unit_price, closed_at)
  values ('__Prova B6 conto__', 'chiuso', 1, 5.00, now()) returning id into v_conto;

  respinto := false;
  begin
    update orders set documento_fiscale = 'fattura', documento_emesso_il = current_date
     where id = v_conto;
  exception when sqlstate '23514' then respinto := true;
  end;
  if not respinto then
    raise exception 'Un conto si e'' dichiarato «fattura» senza numero.';
  end if;

  -- Con la data E il numero passa; e lo scontrino non chiede niente.
  update orders set documento_fiscale = 'fattura', documento_emesso_il = current_date,
                    documento_numero = '__B6-1__'
   where id = v_conto;
  update orders set documento_fiscale = 'scontrino', documento_emesso_il = null,
                    documento_numero = null
   where id = v_conto;
  if (select documento_fiscale from orders where id = v_conto) <> 'scontrino' then
    raise exception 'Uno scontrino senza numero e'' stato respinto: il vincolo si e'' allargato troppo.';
  end if;

  -- ===== 6.2 e 6.3 — le tracce =====
  insert into foraged_items (species, harvest_date, harvest_location)
  values ('__Prova B6 asparagi__', current_date, 'bosco di prova') returning id into v_rac;
  delete from foraged_items where id = v_rac;
  if not exists (select 1 from deleted_records
                  where table_name = 'foraged_items' and record_id = v_rac::text) then
    raise exception 'La raccolta propria cancellata non ha lasciato traccia.';
  end if;

  insert into tag_anticipazioni (etichetta) values ('__Prova B6 tag__') returning id into v_tag;
  insert into anticipazioni_socio (entity_id, importo, pagata_il, tag_id, nota)
  values (e1, 12.00, current_date, v_tag, '__Prova B6__') returning id into v_ant;
  delete from anticipazioni_socio where id = v_ant;
  if not exists (select 1 from deleted_records
                  where table_name = 'anticipazioni_socio' and record_id = v_ant::text) then
    raise exception 'La nota «di tasca mia» cancellata non ha lasciato traccia.';
  end if;

  -- E il censimento delle tabelle sorvegliate è cresciuto di quattro.
  select count(*) into n from pg_trigger
   where tgname = 'trg_log_delete' and not tgisinternal;
  if n < 19 then
    raise exception 'Le tabelle nel registro delle cancellazioni sono %, meno delle 19 attese.', n;
  end if;

  -- PULIZIA
  delete from haccp_non_conformities where description like '\_\_Prova B6%';
  delete from orders where id = v_conto;
  delete from anticipazioni_socio where tag_id = v_tag;
  delete from tag_anticipazioni where id = v_tag;
  delete from deleted_records
   where record_id in (v_rac::text, v_ant::text)
      or (table_name = 'orders' and record->>'table_label' = '__Prova B6 conto__');

  select count(*) into n from haccp_non_conformities where description like '\_\_Prova B6%';
  if n <> 0 then raise exception 'La verifica ha lasciato % non conformita''.', n; end if;
  select count(*) into n from foraged_items where species like '\_\_Prova B6%';
  if n <> 0 then raise exception 'La verifica ha lasciato % raccolte.', n; end if;
  select count(*) into n from orders where table_label = '__Prova B6 conto__';
  if n <> 0 then raise exception 'La verifica ha lasciato % conti.', n; end if;
  select count(*) into n from deleted_records
   where record_id in (v_rac::text, v_ant::text);
  if n <> 0 then raise exception 'La verifica ha lasciato % lapidi nel registro.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 6: una non conformita'' non si chiude senza rimedio, una fattura ha un numero, e i registri lasciano traccia.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000010', 'i_registri_che_si_esibiscono')
on conflict (version) do nothing;

select
  (select count(*) from pg_trigger where tgname = 'trg_log_delete' and not tgisinternal) as tabelle_tracciate,
  (select count(*) from haccp_non_conformities where resolved
     and coalesce(btrim(corrective_action), '') = '')                                   as risolte_senza_rimedio,
  (select count(*) from orders where documento_fiscale = 'fattura'
     and coalesce(btrim(documento_numero), '') = '')                                    as fatture_senza_numero;
