-- =====================================================================
-- «VARIE ED EVENTUALI» AL POSTO DI «IMBALLAGGI E ASPORTO» — 30/08/2026
-- =====================================================================
--
-- 🔴 DECISIONE DI ALESSIO, con la sua ragione: **l'asporto non lo farà.**
-- Delle sei categorie dei materiali di consumo proposte il 29/08 ne cambia
-- una sola; le altre cinque vanno bene così.
--
-- ⚠️ CAMBIA ANCHE IL CODICE, non solo il nome che si legge. Una riga che si
-- chiama «Varie ed eventuali» e dentro dice `imballaggi` è una frase
-- destinata a diventare falsa per chi legge il database fra sei mesi — e in
-- questo progetto la parola nascosta e la parola visibile che dicono cose
-- diverse sono la famiglia di difetti che si insegue da giorni.
--
-- 🔴 E CAMBIARE UN CODICE NON È GRATIS: `ingredients.category` è una CHIAVE
-- ESTERNA verso `categorie_ingrediente.codice`, con `on update no action`.
-- L'ho scoperto **provando a rompere la verifica** — ho inserito un prodotto
-- in «imballaggi» per vedere il controllo scattare, e me l'ha rifiutato il
-- database prima ancora di arrivarci.
-- Le due conseguenze, e sono opposte:
--   · **un prodotto orfano è impossibile per costruzione** — il caso da cui
--     mi stavo difendendo non può accadere, e il controllo (3) qui sotto è
--     una rete che non può scattare. Resta perché costa niente e perché una
--     rete che dichiara di non poter scattare è un'informazione;
--   · **ma se un prodotto ci punta, è la RINOMINA a essere respinta** — con
--     un errore di vincolo in inglese, che in faccia a chi applica non dice
--     né cosa fare né perché. Per questo il controllo vero sta **PRIMA**
--     dell'update, in italiano, e nomina la via d'uscita.
--
-- ⚠️ MISURATO PRIMA DI SCRIVERLA, su tutti e due i database: **zero**
-- prodotti in `imballaggi` in produzione e **zero** sul progetto di prova.
-- La migrazione non si fida di questa misura: la **rifà**. *Una misura di
-- ieri non è una condizione di oggi.*
--
-- ⚠️ COSA RESTA DA DECIDERE, e va detto invece di nasconderlo: dopo questa
-- migrazione i materiali hanno DUE contenitori generici — «Varie ed
-- eventuali» e «Altro», che ha `ambito = 'entrambi'`. Il commento della
-- migrazione del 29/08 diceva che sdoppiare «Altro» darebbe *«due righe che
-- dicono la stessa cosa»*, ed è esattamente quello che succede adesso.
-- Non si tocca «Altro» qui: quale delle due tenere è una decisione di
-- Alessio, ed è una domanda del riepilogo di stanotte.

-- IL CONTROLLO CHE VIENE PRIMA. Se qualcuno ha messo un prodotto in
-- «Imballaggi e asporto» fra la misura e adesso, la rinomina verrebbe
-- respinta dalla chiave esterna con un errore che non spiega niente. Qui si
-- rifiuta in italiano, dicendo cosa fare.
do $prima$
declare
  v_dentro int;
begin
  select count(*) into v_dentro from ingredients where category = 'imballaggi';
  if v_dentro > 0 then
    raise exception
      'Non posso rinominare «Imballaggi e asporto»: ci sono gia'' % prodotti dentro (%). Spostali in un''altra categoria dal Magazzino, poi riapplica.',
      v_dentro,
      (select string_agg(name, ', ' order by name) from ingredients where category = 'imballaggi');
  end if;
end
$prima$;

update categorie_ingrediente
   set codice = 'varie_materiali',
       nome = 'Varie ed eventuali'
 where codice = 'imballaggi';

comment on table categorie_ingrediente is
  'Le categorie di un prodotto, alimentare o no. ⚠️ «Varie ed eventuali» ha preso il posto di «Imballaggi e asporto» il 30/08/2026, per decisione di Alessio: l''asporto non lo fara''.';

do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_vecchia   int;
  v_nuova     int;
  v_orfani    int;
  v_materiali int;
begin
  -- (1) LA VECCHIA NON C'È PIÙ, LA NUOVA C'È. Due controlli e non uno: se
  --     l'update non avesse attecchito, contare solo la nuova direbbe «zero»
  --     e contare solo la vecchia direbbe «una» — servono tutt'e due per
  --     distinguere «non fatto» da «fatto a metà».
  select count(*) into v_vecchia from categorie_ingrediente where codice = 'imballaggi';
  select count(*) into v_nuova from categorie_ingrediente
   where codice = 'varie_materiali' and nome = 'Varie ed eventuali';

  if v_vecchia <> 0 then
    raise exception 'La categoria «imballaggi» esiste ancora: la sostituzione non ha attecchito.';
  end if;
  if v_nuova <> 1 then
    raise exception 'La categoria «Varie ed eventuali» non c''e'' (trovate %): la sostituzione non ha attecchito.', v_nuova;
  end if;

  -- (2) NESSUN PRODOTTO PUNTA A UNA CATEGORIA CHE NON ESISTE.
  --     ⚠️ È una rete che NON PUÒ SCATTARE, ed è dichiarato: la chiave
  --     esterna `ingredients_category_fkey` lo impedisce prima. Resta come
  --     affermazione verificabile — se un giorno quella chiave sparisse,
  --     questo diventerebbe l'unico posto che se ne accorge.
  select count(*) into v_orfani
    from ingredients i
   where i.category is not null
     and not exists (select 1 from categorie_ingrediente c where c.codice = i.category);
  if v_orfani > 0 then
    raise exception
      'Ci sono % prodotti con una categoria che non esiste piu''. Rimettili a posto prima di riapplicare.',
      v_orfani;
  end if;

  -- (3) LE SEI DEI MATERIALI SONO ANCORA SEI: rinominare non deve toglierne
  --     né aggiungerne.
  select count(*) into v_materiali from categorie_ingrediente
   where ambito = 'materiali' and attiva;
  if v_materiali <> 6 then
    raise exception 'Le categorie dei materiali sono % invece di 6.', v_materiali;
  end if;

  -- ⚠️ Niente da cancellare: questa migrazione non crea righe di prova.
  perform pretendi_nessun_residuo(v_foto, 'la sostituzione di «Imballaggi e asporto»');
  raise notice 'Fatto: «Varie ed eventuali» al posto di «Imballaggi e asporto». Categorie dei materiali: %. Prodotti con categoria inesistente: %.',
    v_materiali, v_orfani;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000001', 'varie_ed_eventuali_al_posto_dell_asporto') on conflict (version) do nothing;
