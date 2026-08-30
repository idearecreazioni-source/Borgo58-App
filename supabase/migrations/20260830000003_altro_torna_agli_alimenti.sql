-- =====================================================================
-- «ALTRO» TORNA A ESSERE SOLO DEGLI ALIMENTI — 30/08/2026
-- =====================================================================
--
-- 🔴 DECISIONE DI ALESSIO: «Varie ed eventuali» e «Altro» sono la stessa
-- idea in due posti, e «Altro» e' pure condiviso con gli alimenti. Fra i
-- materiali di consumo ne resta uno solo, il suo.
--
-- ⚠️ IL COMMENTO DELLA MIGRAZIONE DEL 29/08 LO AVEVA GIA' DETTO, e diceva
-- il contrario di quello che poi e' successo: sdoppiare «Altro» avrebbe dato
-- *«due righe che dicono la stessa cosa»*. Sdoppiarlo non serviva — bastava
-- che il generico dei materiali fosse uno, e con la rinomina di stamattina
-- ce ne sono due. Questa toglie quello di troppo dalla parte giusta.
--
-- ⚠️ NON SI CANCELLA «ALTRO»: resta, e resta legale, per gli alimenti che ce
-- l'hanno addosso. Misurato il 30/08 sul progetto di prova: **16 prodotti
-- alimentari** sono in «Altro» e non si toccano. Cambia solo l'AMBITO —
-- «entrambi» diventa «alimenti» — cioe' smette di essere proposto quando si
-- compila la scheda di un materiale di consumo.
--
-- 🔴 E LA SANATORIA NON E' FACOLTATIVA. Misurato: sul progetto di prova ci
-- sono **4 prodotti NON alimentari** dentro «Altro». Cambiato l'ambito, la
-- loro categoria resterebbe **legale ma non piu' proponibile** (regola del
-- 27/08), quindi aprendo la loro scheda il menu si troverebbe davanti un
-- valore che non ha fra le opzioni — e un menu a tendina che riceve un
-- valore fuori elenco **mostra la prima opzione**, senza nessun errore
-- (trappola del 27/08). Si spostano in «Varie ed eventuali», che e'
-- esattamente dove Alessio li vuole.
-- ⚠️ In produzione la sanatoria tocchera' **zero righe**: misurato oggi,
-- `ingredients` e' vuota. Lo dichiara invece di tacere.
-- ⚠️ E si applica UNA VOLTA SOLA, guardando il registro delle migrazioni:
-- rieseguirla dopo che Alessio avesse rimesso a mano un materiale in
-- «Altro» sposterebbe indietro una sua scelta legittima.

do $sanatoria$
declare
  v_gia    boolean;
  v_spost  integer := 0;
begin
  select exists (select 1 from applied_migrations where version = '20260830000003')
    into v_gia;

  if v_gia then
    raise notice 'La sanatoria era gia'' stata applicata: nessun prodotto spostato.';
  else
    update ingredients
       set category = 'varie_materiali'
     where category = 'altro'
       and not alimentare;
    get diagnostics v_spost = row_count;
    raise notice 'Prodotti non alimentari spostati da «Altro» a «Varie ed eventuali»: %.', v_spost;
  end if;
end
$sanatoria$;

update categorie_ingrediente set ambito = 'alimenti' where codice = 'altro';

do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ambito   text;
  v_materiali int;
  v_alimenti  int;
  v_orfani    int;
  v_prop      int;
begin
  -- (1) L'AMBITO E' CAMBIATO. Se l'update non avesse attecchito questo e' il
  --     solo posto che se ne accorgerebbe.
  select ambito into v_ambito from categorie_ingrediente where codice = 'altro';
  if v_ambito is distinct from 'alimenti' then
    raise exception '«Altro» ha ambito % invece di «alimenti»: la sostituzione non ha attecchito.',
      coalesce(v_ambito, '(non esiste)');
  end if;

  -- (2) FRA I MATERIALI IL GENERICO E' UNO SOLO. Si chiede alla funzione che
  --     la schermata usa davvero (`categorie_proponibili`), non alla tabella:
  --     e' li' che il difetto si vedrebbe.
  select count(*) into v_prop from categorie_proponibili('materiali')
   where codice in ('altro', 'varie_materiali');
  if v_prop <> 1 then
    raise exception 'Fra i materiali i contenitori generici proponibili sono % invece di 1.', v_prop;
  end if;

  -- (3) E DALLA PARTE DEGLI ALIMENTI «ALTRO» C'E' ANCORA. Togliere il
  --     doppione non deve portarsi via il generico che serviva.
  select count(*) into v_alimenti from categorie_proponibili('alimenti')
   where codice = 'altro';
  if v_alimenti <> 1 then
    raise exception '«Altro» non e'' piu'' proponibile fra gli alimenti: e'' stato tolto dalla parte sbagliata.';
  end if;

  -- (4) NESSUN MATERIALE E' RIMASTO IN UNA CATEGORIA CHE NON GLI SI PROPONE
  --     PIU'. E' il caso silenzioso: la scheda si aprirebbe mostrando la
  --     prima voce dell'elenco al posto della sua.
  select count(*) into v_orfani
    from ingredients i
   where not i.alimentare
     and not exists (select 1 from categorie_proponibili('materiali') c where c.codice = i.category);
  if v_orfani > 0 then
    raise exception 'Ci sono % materiali in una categoria che non si propone piu'' fra i materiali.', v_orfani;
  end if;

  select count(*) into v_materiali from categorie_ingrediente
   where ambito in ('materiali', 'entrambi') and attiva;

  perform pretendi_nessun_residuo(v_foto, 'la verifica di «Altro» fra i materiali');
  raise notice 'Fatto: fra i materiali resta «Varie ed eventuali». Categorie offerte ai materiali: %. Materiali senza categoria proponibile: %.',
    v_materiali, v_orfani;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000003', 'altro_torna_agli_alimenti') on conflict (version) do nothing;
