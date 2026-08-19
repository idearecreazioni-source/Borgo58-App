# Quesiti per i consulenti — raccoglitore unico

**Aggiornato il 15/08/2026.**

A cosa serve: le domande aperte per i consulenti erano sparse in una
dozzina di posti — un avviso in una schermata, un rilievo in un referto,
una riga di un mandato, la nota di un adempimento seminato in una
migrazione. Sparse così, la risposta arriva e **non torna indietro nel
punto che l'aspettava**: la schermata continua a dire «da validare» per
sempre, e nessuno sa più cosa fosse esattamente la domanda.

Qui stanno tutte, con **dove vivono nel codice**. Quando una risposta
arriva, si scrive sotto la sua domanda e da lì si va a chiudere il punto
che la citava.

⚠️ **Nessun importo in questo file: il repository è pubblico.** Le
domande si formulano in modo che si possano fare ad alta voce senza
leggere cifre; le cifre stanno nel gestionale.

**Gli identificativi sono stabili.** `L1` è citato dentro
`src/pages/cassa/ScontiOmaggi.jsx` — un identificativo che cambia
numero è un rimando rotto. L'**ordine dell'elenco** è per urgenza, i
**numeri** no: si aggiunge in coda al gruppo e si lascia stare il resto.

**Stato**: `aperto` · `risposto il [data]`, con la risposta sotto.

---

# LAURA — commercialista

## L6 · Autofattura agricola per gli acquisti da piccoli produttori

**Contesto.** Il progetto compra ortaggi da produttori locali e prevede
un'azienda agricola propria. Oggi il gestionale non sa come si documenta
un acquisto da un produttore in regime di esonero.

**Domanda.** «Se il produttore ha partita IVA in regime di esonero — l'articolo 34
comma 6 del DPR 633/72 — l'autofattura è la strada giusta? La posso fare
cumulativa a fine mese appoggiandomi ai DDT, o serve documento per
documento? Quale percentuale di compensazione si applica agli ortaggi? E
come si gestisce dentro Fatture in Cloud?»

**Cosa cambia nell'app.** Decide se serve un tipo di documento nuovo nel
carico da fattura, se il raggruppamento è mensile o per consegna, e con
quale aliquota di compensazione si valorizza la riga. Tocca anche la
cessione intercompany dell'orto (vedi `L5`).

**Stato**: aperto.

---

## L7 · Acquisto da chi NON ha partita IVA

**Contesto.** Gemello del precedente: il vicino che porta due cassette di
pomodori non è un'azienda agricola. Oggi quell'acquisto non ha nessuna
forma nel gestionale.

**Domanda.** «Se il produttore non ha partita IVA, la ricevuta di cessione
occasionale — articolo 67 comma 1 lettera i del TUIR — è la forma
corretta? E quel costo per la società è deducibile, oppure va ripreso a
tassazione?»

**Cosa cambia nell'app.** Determina il valore dell'attributo di
deducibilità (vedi `L9`) su un'intera classe di acquisti, e se serve un
modello di ricevuta stampabile dal gestionale.

**Stato**: aperto.

---

## L8 · Il confine dell'occasionalità

**Contesto.** Comprare due volte l'anno dallo stesso vicino è
occasionale; comprare ogni settimana non lo è più. Il gestionale può
sorvegliare la soglia solo se sa quale sorvegliare.

**Domanda.** «Qual è il tetto annuo per singolo venditore che non devo
superare, e a partire da quale frequenza di acquisti scatta
l'abitualità?»

**Cosa cambia nell'app.** Fa nascere un avviso vero — «questo venditore
si sta avvicinando alla soglia» — invece di un controllo che nessuno può
fare a mente. Senza la risposta l'avviso non si costruisce: una soglia
inventata da noi è peggio di nessuna soglia.

**Stato**: aperto.

---

## L9 · Quali costi ricorrenti di un ristorante sono indeducibili

**Contesto.** Il mandato «personale e tesoreria» (§9) chiede un attributo
di deducibilità **su ogni voce di costo**, perché la Proiezione lavora su
due basi: l'utile gestionale e l'imponibile. La struttura si costruisce
comunque; l'elenco dei casi no.

**Domanda.** «Nella vita normale di un ristorante, quali costi ricorrenti
sono indeducibili o deducibili solo in parte? Multe e sanzioni,
rappresentanza, spese senza documento: mi fai l'elenco dei casi che
incontrerò davvero?»

**Cosa cambia nell'app.** È il quesito che riempie l'attributo di
deducibilità. Senza, ogni costo nasce «deducibile» per difetto — cioè con
una risposta data dal programma al posto del commercialista, e la
Proiezione stima l'imposta più bassa del vero **sempre nella stessa
direzione**.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §9.

**Stato**: aperto.

---

## L10 · Anticipazioni del socio

**Contesto.** Alessio paga di tasca propria spese della società e poi si
rimborsa dalla cassa. Succede già oggi, e il Blocco 7 del mandato lo
mette a registro.

**Domanda.** «Quando pago io una spesa della società e poi mi rimborso
dalla cassa, come vuoi che te lo comunichi? E sotto quale importo resta
un fatto interno che non ti devo segnalare?»

**Cosa cambia nell'app.** Fissa la soglia oltre la quale una nota entra
**da sola** nel pacchetto mensile per il commercialista, e la forma della
comunicazione. Il mandato prevede già tre eccezioni automatiche —
pagamento da conto personale, importo oltre soglia, nota ancora aperta a
fine mese — ma la soglia è un parametro suo, non un numero nel codice.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §8.

**Stato**: aperto.

---

## L11 · Un acquisto rimasto senza documento

**Contesto.** Capita: si paga e la ricevuta non arriva, o si perde. Il
mandato prevede che una voce senza documento nasca marcata
**indeducibile**, ma non dice se quella marcatura è definitiva.

**Domanda.** «Un acquisto rimasto senza documento si può sanare a
posteriori, e come? E qual è il trattamento corretto quando pago
personalmente una spesa della società?»

**Cosa cambia nell'app.** Decide se la marcatura «senza documento» è uno
stato **reversibile** — con una porta per allegare il documento dopo — o
un fatto definitivo. Sono due modelli di dati diversi, e cambiarlo dopo
significa rifare le righe già registrate.

**Stato**: aperto.

---

## L17 · Su quale costo si calcola il food cost — imponibile o pagato

**Contesto.** Il costo di un ingrediente entra nel gestionale da due strade
diverse, e dal 19/08/2026 tutte e due scrivono il prezzo di listino:

- **da un documento** (il carico da fattura): il costo unitario è quello che
  il documento dichiara, cioè di norma l'**imponibile**;
- **da una spesa senza documento** (la lista della spesa, il mercato):
  l'importo **pagato**, che non ha nessuna IVA da scorporare.

Decisione di Alessio del 19/08: le due basi convivono, perché **tutti e due
sono il costo vero per il locale**.

⚠️ **Il caso che resta aperto è il terzo**: un acquisto con **scontrino**.
Lì l'IVA c'è scritta, ma se non è recuperabile il costo vero per il locale è
l'importo **pieno** — mentre il gestionale, seguendo il documento,
userebbe l'imponibile e sottostimerebbe il food cost.

**Domanda.** «Per un ristorante, su quali acquisti l'IVA è effettivamente
recuperabile? Quando non lo è, il costo da usare per calcolare il food cost
e i margini è l'importo pieno pagato?»

**Cosa cambia nell'app.** Decide se il costo unitario che entra in
`price_history` debba essere l'imponibile o il lordo **a seconda del tipo di
documento**. Oggi non c'è nessuna regola che distingua i due casi.

⚠️ **Quanto è grande il problema oggi, misurato in produzione il 19/08 e non
stimato**: zero fatture fornitori registrate, zero movimenti di prima nota,
zero movimenti con scontrino. Le 26 righe di storico prezzi vengono tutte
dalle fatture di collaudo. **È una possibilità teorica, non un problema
vivo** — ed è il momento giusto per deciderlo, perché ogni riga scritta
prima della risposta è una riga da rivedere dopo.

**Stato**: aperto. ⚠️ Fino alla risposta **non si tocca niente**: il
gestionale scrive quello che il documento dichiara, e quello che si paga
quando un documento non c'è.

---

## L12 · In che forma vuoi i documenti che non passano dallo SdI

**Contesto.** Corrispettivi, ricevute, autofatture, prospetti del
personale: una parte di ciò che il gestionale produce non transita per lo
Sistema di Interscambio, e oggi non c'è nessun formato concordato.

**Domanda.** «I documenti che non passano dallo SdI, in che forma e con
quale cadenza li vuoi? Un PDF con le scansioni, un Excel, o li carico su
un tuo portale?»

**Cosa cambia nell'app.** È la specifica del **pacchetto mensile** che il
gestionale deve saper produrre. Finché non c'è, il pacchetto si progetta
a indovinare — e un formato sbagliato si scopre al primo invio, dopo
averlo costruito.

**Stato**: aperto.

---

## L1 · Autofattura TD27 sugli omaggi sistematici — e su quale base

**Contesto.** Un omaggio non è un movimento di soldi e resta solo nel
gestionale, ma se gli omaggi diventano sistematici possono generare un
obbligo di autofattura. Il gestionale registra **due** numeri diversi per
lo stesso omaggio: il valore a listino e il costo degli ingredienti,
congelato al momento della chiusura.

**Domanda.** «Da quale volume e con quale frequenza gli omaggi che facciamo
generano un obbligo di autofattura TD27? E la base da usare qual è: il
prezzo che il cliente avrebbe pagato, o quanto quel piatto ci è costato
davvero?»

**Cosa cambia nell'app.** Il riepilogo mensile degli omaggi oggi mostra
tutti e due i numeri proprio perché la scelta non è nostra. La risposta
dice **quale dei due** va nel riepilogo per il commercialista, e se serve
un avviso quando la frequenza si avvicina alla soglia.

⚠️ Il costo si può calcolare **solo il giorno stesso**, coi prezzi di
quel giorno: per questo viene già registrato adesso, senza aspettare la
risposta. Fra sei mesi non si ricostruisce.

**Dove vive**: `src/pages/cassa/ScontiOmaggi.jsx` (cita questo quesito per
nome), `docs/referti/20260813_moduli_soldi_e_obblighi.md` §5.

**Stato**: aperto.

---

## L2 · Su quale base si calcola l'IRAP

**Contesto.** Il gestionale calcola oggi IRES e IRAP **sullo stesso
numero**, l'utile stimato. Per l'IRES è corretto; per l'IRAP no — ha una
base sua, e per un locale con dipendenti è tipicamente più alta
dell'utile.

**Domanda.** «Su quale base devo calcolare l'IRAP? Oggi la calcolo
sull'utile come l'IRES, e so che è una semplificazione: quali voci non si
scalano, a partire dal costo del lavoro?»

**Cosa cambia nell'app.** È l'unico rilievo ancora aperto del referto del
13/08. Nessuna formula viene inventata: finché non c'è risposta,
`calcola_imposte()` restituisce il numero **insieme alla frase** che ne
dichiara il limite, e la frase viaggia con il numero in ogni schermata
che lo mostra.

⚠️ Il punto da dire ad alta voce: la stima non è approssimata a caso, è
**storta sempre nella stessa direzione** — ottimista.

**Dove vive**: `docs/referti/20260813_moduli_soldi_e_obblighi.md` §2,
funzione `calcola_imposte()`, tutto il modulo Proiezione fiscale.

**Stato**: aperto.

---

## L3 · Conferma dei parametri fiscali

**Contesto.** Aliquote, percentuale della maxi-deduzione, misura degli
acconti e giorni di scadenza vivono in un unico posto nel database e li
governa Alessio. Nessuno li ha ancora confermati.

**Domanda.** «Mi confermi le aliquote, la misura degli acconti e le date di
scadenza che devo impostare? E la maxi-deduzione: nel nostro caso si
applica, e in che misura?»

**Cosa cambia nell'app.** Il Simulatore ha un campo **«Confermati da
Laura il»**: finché è vuoto, ogni schermata del modulo scrive che è una
semplificazione. Riempirlo è ciò che fa sparire l'avvertenza — e la fa
sparire ovunque insieme, perché la frase esce dal motore di calcolo e non
dal testo di una pagina.

⚠️ **La maxi-deduzione nasce spenta**, ed è voluto: un'agevolazione
applicata da sola abbassa le imposte stimate sempre nella stessa
direzione.

**Dove vive**: `src/pages/fiscale/SimulatoreFiscale.jsx`, colonna
`fiscal_settings.parametri_confermati_da_laura`.

**Stato**: aperto.

---

## L4 · Le quote deducibili del catalogo deduzioni

**Contesto.** Il modulo Deduzioni fiscali stima quanto di una spesa è
deducibile e mostra da quale regola deriva ogni importo. Le regole non
sono state validate.

**Domanda.** «Le percentuali di deducibilità che ho impostato — carburante,
telefonia, rappresentanza, ammortamenti — sono quelle giuste per la
nostra attività?»

**Cosa cambia nell'app.** Toglie il «da validare» dalla schermata e rende
utilizzabili gli importi che alimentano la Proiezione. Si incrocia con
`L9`: quello dice **quali** costi, questo **quanto**.

**Dove vive**: `src/pages/fiscale/DeduzioniFiscali.jsx`.

**Stato**: aperto.

---

## L5 · Cessione intercompany orto → S.r.l.s.

**Contesto.** Vincolo portante del progetto: due entità fiscali distinte,
collegate da una cessione fatturata. Il prezzo di trasferimento diventa il
costo dell'ingrediente a produzione interna, quindi entra nel food cost.

**Domanda.** «Come si documenta la cessione dall'azienda agricola alla
S.r.l.s., e come si determina il prezzo di trasferimento? Ci sono vincoli
sul margine?»

**Cosa cambia nell'app.** Il gestionale registra i dati della cessione ma
**non emette il documento fiscale**, ed è una scelta. La risposta dice se
quella divisione regge e su quale numero si valorizza l'ingrediente che
arriva dall'orto — cioè un pezzo del food cost.

**Dove vive**: `src/pages/agricolo/Cessioni.jsx`.

**Stato**: aperto.

---

## L13 · Trattamento fiscale dei pasti al personale

**Contesto.** La brigata mangia ogni giorno. È food cost che non genera
ricavo, e il mandato prevede una causale di scarico dedicata perché non
gonfi il food cost dei piatti venduti.

**Domanda.** «I pasti che do al personale come si trattano fiscalmente? Si
incrociano con la questione degli omaggi sistematici?»

**Cosa cambia nell'app.** La causale «vitto personale» **si costruisce
comunque**: serve al food cost, e quella parte non aspetta nessuno. La
risposta riempie la casella fiscale e decide se quel consumo va anche nel
riepilogo per il commercialista.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §6, coda
già dichiarata in `CLAUDE.md` §10.

**Stato**: aperto.

---

## L14 · GDPR — cosa posso tenere nel gestionale, e per quanto

**Contesto.** Il gestionale conserva dati di clienti (nome, telefono,
email, note libere che possono contenere allergie, cioè dati sulla
salute) e di personale (buste paga, documenti, ferie, malattia). Per i
clienti c'è già una cancellazione automatica dopo un numero di mesi
deciso da Alessio; per il personale non c'è nessuna cancellazione, ed è
voluto.

**Domanda.** «Quali dati del personale e dei clienti posso conservare nel
gestionale, e per quanto tempo? E ha senso archiviare copia delle buste
paga, o mi basta il prospetto dei costi?»

**Cosa cambia nell'app.** La seconda metà della domanda cambia un pezzo
del Blocco 1 del mandato: se il costo arriva dal prospetto, i cedolini
nel gestionale potrebbero non servire più — e sono dati personali tenuti
senza motivo. La prima metà chiude il termine di conservazione, che oggi
è un numero scelto da Alessio senza validazione.

**Dove vive**: `docs/DATI_PERSONALI.md`,
`docs/mandati/20260815_personale_e_tesoreria.md` §2.

**Stato**: aperto.

---

## L15 · Il testo dell'informativa privacy

**Contesto.** L'informativa pubblica collegata al form di prenotazione è
**online con testo segnaposto**, marcato «DA SOSTITUIRE» in tre punti:
dati del titolare del trattamento, conservazione delle prenotazioni
confermate, indirizzo per esercitare i diritti.

**Domanda.** «Mi verifichi il testo dell'informativa privacy che è già
pubblicata sul sito? In particolare: per quanto tengo i dati delle
prenotazioni **confermate**, visto che quelle rifiutate si cancellano da
sole.»

**Cosa cambia nell'app.** È l'unica cosa di questo elenco che è **già
visibile a un cliente vero**. Il testo attuale dichiara di essere
provvisorio, ma resta un'informativa incompleta su una pagina pubblica.

**Dove vive**: `src/pages/public/InformativaPrivacy.jsx`, collegata dalla
casella di consenso di `/prenota`.

**Stato**: aperto.

---

## L16 · Le date degli adempimenti societari

**Contesto.** Sette adempimenti societari con importi e codici F24 sono
in Agenda dal 02/08/2026, con date che guardano al 2027. La S.r.l.s. però
esiste dal 03/08/2026, e due voci nacquero già dichiarate incerte.

**Domanda.** «Ora che la società esiste da agosto 2026, le date che ho in
agenda sono giuste? Mi confermi la data esatta di chiusura dell'esercizio
e quindi il termine per l'approvazione del bilancio? E sul titolare
effettivo: qual è lo stato dell'obbligo oggi?»

**Cosa cambia nell'app.** Sposta date reali di adempimenti reali. La voce
del titolare effettivo è in Agenda **senza scadenza apposta**, perché
trattarla come un adempimento a data certa sarebbe stato falso: la
risposta decide se diventa una scadenza vera.

**Dove vive**: `supabase/migrations/20260802000001_agenda.sql`, tabella
`tasks`, categoria «Fisco e scadenze».

**Stato**: aperto.

---

# GIANNA — consulente del lavoro

## G1 · Il prospetto mensile del costo aziendale

**Contesto.** È il quesito che sblocca il blocco più importante del
mandato. Oggi il costo del personale — la voce di spesa più grossa
dell'anno — **non passa da nessun modulo**, e il conto economico lo
dichiara mancante. Il cedolino non basta: mostra il mondo visto dal
dipendente, non il costo per l'azienda.

**Domanda.** «Oltre alle buste paga, mi fornisci ogni mese il prospetto del
costo aziendale? In che formato me lo mandi? E cosa include: TFR, ratei
di tredicesima e quattordicesima, Fondo EST, ente bilaterale?»

**Cosa cambia nell'app.** Decide la forma della porta d'ingresso e cosa
si può leggere da una fotografia del documento. ⚠️ **Senza la risposta la
forma del documento non si indovina**: si costruisce il resto del mandato
e si aspetta — è scritto nelle dipendenze del mandato stesso.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §2.

**Stato**: aperto.

---

## G2 · Il coefficiente di ripiego

**Contesto.** Se il prospetto non arriva in tempo, il consuntivo del mese
resta senza la sua voce più grossa. Il mandato prevede una stima dal
lordo, **etichettata «stimata»**, mai mescolata a un dato misurato.

**Domanda.** «Se un mese il prospetto non fosse disponibile, quale
coefficiente uso per stimare il costo azienda partendo dal lordo?»

**Cosa cambia nell'app.** È un parametro che Alessio imposta, non un
numero nel codice. Senza, il ripiego non esiste e il mese resta vuoto —
che è comunque meglio di un numero inventato, ma peggio di una stima
dichiarata.

**Stato**: aperto.

---

## G3 · I premi in denaro — quando e come comunicarteli

**Contesto.** I premi che Alessio decide di dare sono **retribuzione
premiale**: contributi e IRPEF pieni, nessun regime agevolato, e il
pagamento in contanti è vietato. Passano dal cedolino e dal bonifico.

**Domanda.** «I premi in denaro entro che giorno del mese ti servono per
entrare nel cedolino? E come te li comunico?»

**Cosa cambia nell'app.** Fissa la data di chiusura paghe, che è la
scadenza attorno a cui gira il ciclo del Blocco 2: decisione → pacchetto
per te → cedolino → ritorno nel prospetto. Un premio comunicato tardi
salta un mese, e la riconciliazione lo mostrerebbe come mancante.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §3.

**Stato**: aperto.

---

## G4 · Le mance

**Contesto.** Il modulo mance esiste (raccolta e distribuzione) e fa
alcune verifiche di regime, dichiarando che sono un aiuto e non una
decisione. Manca l'aggancio alla chiusura di serata: le mance incassate
col POS non sono ricavi del locale.

**Domanda.** «Le mance le gestiamo in busta con l'imposta sostitutiva? Ti
serve una comunicazione mensile degli importi per dipendente, e in che
forma?»

**Cosa cambia nell'app.** Decide cosa entra nel pacchetto mensile e con
quale dettaglio. La separazione dai corrispettivi si costruisce comunque:
senza, la cassa sballa ogni sera e la Proiezione gonfia i ricavi
esattamente del valore delle mance.

**Dove vive**: `src/pages/personale/Mance.jsx`,
`docs/mandati/20260815_personale_e_tesoreria.md` §6.

**Stato**: aperto.

---

## G5 · Se i premi diventassero sistematici

**Contesto.** Domanda di prospettiva, non urgente: oggi i premi sono
occasionali.

**Domanda.** «Se i premi diventassero sistematici, converrebbe un accordo di
secondo livello per la detassazione dei premi di risultato?»

**Cosa cambia nell'app.** Se la risposta è sì, il premio smette di essere
una riga sola e acquista un attributo — «rientra nell'accordo» — che
cambia sia il cedolino sia il costo. Meglio saperlo prima di aver
registrato un anno di premi senza quel campo.

**Stato**: aperto.

---

## G6 · Anticipo su stipendio

**Contesto.** Prima o poi qualcuno lo chiede, e va distinto da
un'anticipazione del socio (che è tutt'altro) e da un prestito personale.

**Domanda.** «Se un dipendente mi chiede un anticipo sullo stipendio, qual è
la procedura corretta?»

**Cosa cambia nell'app.** Decide se l'anticipo è una riga della scheda
del dipendente, un movimento di cassa, o tutti e due — e soprattutto se
va comunicato a te prima del cedolino. Il mandato tiene già separate tre
famiglie di righe sulla scheda proprio perché due di esse non devono mai
finire nel totale d'impresa.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §4.

**Stato**: aperto.

---

## G7 · Le agevolazioni all'assunzione oggi attive

**Contesto.** Il simulatore di assunzione serve **in fase di colloquio**,
prima di una decisione costosa. ⚠️ Non emette verdetti: gli incentivi
cambiano a ogni legge di bilancio e dipendono da età, condizione
precedente, DURC, rapporti pregressi.

**Domanda.** «Quali agevolazioni all'assunzione sono oggi attive per il
nostro caso, e come le verifichiamo prima di firmare? Non mi serve un
calcolo automatico: mi serve sapere cosa devo controllare.»

**Cosa cambia nell'app.** Riempie la **lista di verifica** del
simulatore, che dice *«potrebbe rientrare in X: verifica con Gianna prima
di firmare»* e mostra la data dei propri parametri. Un'app che afferma
che un'agevolazione spetta sarà falsa entro pochi mesi, e su questo si
perdono soldi veri. **L'apprendistato è il primo caso da mettere in
lista.**

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §5.

**Stato**: aperto.

---

## G8 · Il residuo ferie maturato

**Contesto.** Oggi un permesso si registra con date **e un numero di
giorni digitato a mano**, senza residuo maturato. Il giorno in cui
qualcuno chiede «quante ferie mi restano», la risposta del gestionale non
è affidabile — ed è una domanda che si fa sempre.

**Domanda.** «Il residuo ferie maturato lo calcoli tu e me lo riporti sul
cedolino, o dovrei tenerlo io? Se lo tieni tu, in quale voce del cedolino
lo leggo?»

**Cosa cambia nell'app.** ⚠️ Regola che attraversa tutto il mandato:
**l'app legge e mostra, non ricalcola mai le paghe.** Se il residuo sta
nel cedolino, il gestionale lo **riporta** e, se non torna, lo segnala
invece di correggerlo. Se non ci fosse, servirebbe una decisione a parte
— perché calcolarlo qui creerebbe due verità sullo stesso numero.

**Dove vive**: `docs/referti/20260813_moduli_soldi_e_obblighi.md` §6,
`docs/mandati/20260815_personale_e_tesoreria.md` §1.

**Stato**: aperto.

---

## G9 · Per quanto si conservano i documenti del personale

**Contesto.** Buste paga, documenti e loro scadenze, ferie e malattia non
hanno **nessuna cancellazione automatica**, ed è voluto: sono documenti
di lavoro con obblighi di conservazione. Ma il termine non è scritto da
nessuna parte.

**Domanda.** «Per quanto tempo devo conservare buste paga, documenti dei
dipendenti e registrazioni di ferie e malattia?»

**Cosa cambia nell'app.** Si incrocia con `L14`: dove il commercialista
risponde sul lato privacy, il consulente del lavoro risponde sul lato
obbligo. Il termine più lungo vince, e diventa il parametro della
conservazione — che oggi semplicemente non c'è.

**Dove vive**: `docs/DATI_PERSONALI.md` §2.

**Stato**: aperto.

---

# LAURA + GIANNA INSIEME

## LG1 · Il compenso amministratore

**Contesto.** Sta a cavallo fra i due: va deliberato, sconta contributi,
passa dal cedolino, e non può essere pagato in contanti. Nel mandato è
esplicitamente **fuori** dalla sezione personale del titolare — lì
finiscono solo i pagamenti che Alessio fa con fondi propri per conto
della società.

**Domanda.** «Per il compenso amministratore: che delibera serve, in quale
misura e con quale periodicità me lo consigliate? Qual è
l'inquadramento contributivo, e con quali modalità di pagamento?»

**Cosa cambia nell'app.** In tesoreria il compenso comparirà come
**movimento atteso** e nient'altro. La risposta dice la periodicità — che
è ciò che rende il movimento prevedibile — e conferma che non deve
passare dalla sezione personale, dove sarebbe la cosa sbagliata nel posto
sbagliato.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §8, «fuori
perimetro».

**Stato**: aperto.

---

# ASP DI ENNA

## A1 · Piccoli quantitativi di prodotti primari in Sicilia

**Contesto.** L'orto e la raccolta propria producono piccole quantità
destinate al locale. Il regolamento europeo lascia la fornitura diretta
di piccoli quantitativi alla disciplina nazionale e regionale, e non
sappiamo cosa preveda la Sicilia.

**Domanda.** «La Regione Siciliana ha proprie linee guida sulla fornitura
diretta di piccoli quantitativi di prodotti primari, secondo il
regolamento CE 852/2004 articolo 1 comma 2 lettera c? Ci sono soglie
quantitative da rispettare?»

**Cosa cambia nell'app.** Se esistono soglie, diventano un avviso nel
modulo Agricolo — «stai per superare il quantitativo» — invece di una
cosa da ricordare. Se non esistono, si scrive che non esistono: oggi la
schermata della raccolta propria dichiara una zona grigia normativa senza
poterla sciogliere.

**Dove vive**: modulo Agricolo, `src/pages/haccp/RaccoltaPropria.jsx`.

**Stato**: aperto.

---

# BANCHE — Intesa, MPS, Credem

⚠️ **Questi non sono quesiti da fare dopo: sono criteri per scegliere il
conto**, e la scelta decide che forma avrà il modulo banca. Il conto non
è ancora aperto, quindi si è ancora in tempo.

## B1 · Che formati esporta l'home banking, e c'è un'API

**Contesto.** Il Blocco 6 del mandato prevede l'import dell'estratto
conto con riconciliazione movimento per movimento. Che sia un gesto
settimanale di Alessio o una cosa che avviene da sola dipende
interamente dalla risposta della banca.

**Domanda.** «Che formati esporta l'home banking aziendale — CSV, CAMT.053,
MT940? Ed esistono API o integrazioni per collegare il conto a un
gestionale, date direttamente al titolare?»

**Cosa cambia nell'app.** Con l'export, il caricamento manuale funziona
ovunque e si costruisce una volta sola. Con l'API, **la prima nota si
riempie da sola**. Le banche nate online la danno, quelle tradizionali
quasi mai — espongono i dati solo a intermediari autorizzati, che è una
strada cara con contratti e canone.

⚠️ Il collegamento in tempo reale non esiste comunque: un incasso
elettronico arriva uno o due giorni dopo anche con l'API. Il guadagno
vero è togliere il passaggio a mano, non vedere prima.

**Dove vive**: `CLAUDE.md` §10 (in capo ad Alessio),
`docs/mandati/20260815_personale_e_tesoreria.md` §7.

**Stato**: aperto.

---

## B2 · Il POS e come arrivano gli accrediti

**Contesto.** L'incasso elettronico di stasera non è in banca stasera:
arriva dopo uno o due giorni, **al netto delle commissioni**. Il mandato
chiede una voce «POS in transito» **dal primo giorno**, perché senza
quella il saldo banca teorico non tornerà mai.

**Domanda.** «Quanto costa il POS, e come arrivano gli accrediti: lordi o al
netto delle commissioni, in quanti giorni, raggruppati o singoli?»

**Cosa cambia nell'app.** Determina come si modella il transito e la
riconciliazione. Se gli accrediti arrivano raggruppati, un movimento in
banca corrisponde a **più serate** e la riconciliazione uno-a-uno non
funziona: è una differenza di struttura, non un dettaglio.

**Dove vive**: `docs/mandati/20260815_personale_e_tesoreria.md` §7b.

**Stato**: aperto.

---

# TIZIANA — biologa, piano HACCP

## T1 · Validazione del piano HACCP

**Contesto.** Il gestionale registra temperature, pulizie, ricevimento
merci, non conformità e produce il manuale esibibile a un'ispezione. È
stato verificato che **faccia quello che dice di fare**; non che quello
che dice sia il piano giusto.

**Domanda.** «Quali registrazioni servono davvero per il nostro locale, con
che frequenza, e con quali soglie? Il piano che ho impostato regge a
un'ispezione?»

**Cosa cambia nell'app.** Le frequenze e le soglie sono già dati
modificabili, non numeri nel codice: la risposta si applica senza toccare
il programma. Quello che potrebbe cambiare è **quali registri servono** —
e un registro che manca non si recupera a posteriori.

**Dove vive**: modulo HACCP,
`docs/referti/20260813_moduli_soldi_e_obblighi.md` («Cosa NON copre»).

**Stato**: aperto.

---

## T2 · Erbe spontanee e raccolta propria

**Contesto.** La schermata «Raccolta propria» traccia erbe spontanee e
prodotti autoraccolti a soli fini HACCP, senza nessun documento fiscale,
e dichiara in testa di essere **da validare prima di un uso in
produzione**.

**Domanda.** «Le erbe spontanee e i prodotti che raccolgo io li posso usare
in cucina? Che tracciabilità devo tenere, e ci sono specie da escludere?»

**Cosa cambia nell'app.** Se la risposta pone condizioni, diventano campi
obbligatori della registrazione. Se pone un divieto, la schermata lo dice
invece di lasciare intendere che basti registrare. Si incrocia con `A1`,
che risponde sul lato quantitativo.

**Dove vive**: `src/pages/haccp/RaccoltaPropria.jsx`.

**Stato**: aperto.

---

*Raccoglitore creato il 15/08/2026 riunendo i quesiti già sparsi nel
repository — schermate, referti, mandati, migrazioni — e aggiungendo
quelli decisi da Alessio lo stesso giorno. Quando una risposta arriva:
si scrive sotto la sua domanda, si cambia lo stato, e si va a chiudere il
punto del codice indicato in «Dove vive». Una risposta che resta solo
qui non ha ancora servito a niente.*
