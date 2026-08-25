# Il giro dal telefono, la stampa e l'Agenda
**25/08/2026 — mandato accodato, cinque blocchi**

Commit sotto questo riepilogo: **c79fba4** *(`Zero testi illeggibili e
zero schermate che scorrono, su tutto il gestionale`)*

**Stato delle migrazioni**, misurato in produzione:

| dove | quante |
|---|---|
| repository | **241** |
| produzione | **241** |
| progetto di prova | **241** |

**Nessuna migrazione in questa consegna**: cinque blocchi di sola
interfaccia. Al database non serviva niente, e **niente aspetta un ok**.

---

## Blocco 1 — le due decisioni sulla stampa

### (a) Il biglietto della cucina a 6,8 mm

Fatto, e uguale su tutti i dispositivi. Le misure sono quelle che il
ticket aveva **stampato dal tablet calibrato** — 5,4 / 6,8 / 10,2 mm
sulla carta — rese fisse dalla classe `.ticket-cucina` nel blocco
`@media print`.

Verificato applicando le regole vere su un ticket vero: righe piatto
**6,80 mm**, note 5,42. Il preconto, che condivide `.stampa-ticket` ma
non porta quella classe, resta a **3,20 / 4,00**.

⚠️ **Scritto accanto alla regola che non è definitiva**, con le parole
del mandato: è stata scelta **senza aver mai stampato niente**, e si
riguarda quando ci sarà la termica in laboratorio.

### (b) Il preconto — cosa usciva prima, e il mio parere

**Cosa usciva prima**, misurato:

| | dal computer | dal tablet calibrato |
|---|---|---|
| preconto, prima | **3,20 mm** | **5,42 mm** |
| preconto, adesso | 3,20 mm | 3,20 mm |

Veniva da `.testo-sala` (0,32 cm veri), quindi **dipendeva dalla
calibrazione dello schermo**.

🔴 **E c'era una terza taglia scritta e mai applicata**: sul preconto sta
`print:text-[13px]` — 3,44 mm — messa lì da qualcuno apposta per la
stampa. È **scavalcata** da `.testo-sala`, che nel foglio di stile viene
dopo (posizione 60149 contro 59362, stessa specificità). **Non ha mai
stampato a 13 punti.**

**Il mio parere**, con le ragioni:

- **3,2 mm va bene, e lo terrei.** Il preconto lo legge il cliente
  **seduto**, a distanza di lettura, con la luce del tavolo: è la
  situazione in cui 3,2 mm sono leggibili senza sforzo. Il ticket è un
  altro mestiere — in piedi, sotto una lampada, con le mani occupate —
  ed è per quello che ha una taglia sua.
- **C'è una ragione pratica in più, che nel ticket non esiste**: su
  **72 mm** di larghezza, un preconto di dieci piatti con nomi lunghi
  («Risotto ai tenerumi e vongole») a 5,4 mm manderebbe quasi ogni riga a
  capo, e lo scontrino si allungherebbe di parecchio. Il ticket di cucina
  ha righe corte («2× Vellutata di zucca»), quindi il corpo grande non
  gli costa niente.
- **Se lo volessi più grande**, il valore che consiglierei non è 5,42 ma
  **3,44** — cioè il `print:text-[13px]` che qualcuno aveva già pensato:
  +7%, si nota poco, non allunga lo scontrino.

**Non ho cambiato niente**: la decisione è tua.

### (c) La regola nel §8

Scritta: *quando una cosa si stampa, la taglia non deve dipendere da dove
hai premuto il pulsante*, coi numeri (4,00 contro 6,77 sullo stesso
biglietto), la nota che **ogni classe di dimensione nuova va aggiunta al
blocco print**, e il limite dichiarato — **nessuno ha mai visto un foglio
uscire da una stampante**. Rovesciamento **n. 50**.

---

## Blocco 2 — il collaudo dal telefono, schermata per schermata

### 🔴 La prima misura era sbagliata, e me ne sono accorto subito

Il pannello del browser era tornato a **1280 punti** dopo una
riapertura, e le prime sei schermate le avevo misurate lì: risultavano
sbordi di 1046, 307, 267 punti che **non esistevano**. Rifatte a 390.
Da allora **la larghezza è riportata in ogni riga della misura**, così
non può succedere in silenzio.

### 🔴 E il misuratore contava come difetto anche ciò che difetto non è

Una tabella più larga dello schermo **dentro un riquadro che scorre** va
bene: si scorre il riquadro. Una che si trascina dietro **la pagina** no.
Il criterio giusto è `document.scrollWidth > clientWidth`, e con quello
l'elenco delle malate si è accorciato: Magazzino e Tracciabilità, che
sembravano rotte (283 e 305), erano **già a posto**.

### Le tre famiglie trovate

| famiglia | dove | cura |
|---|---|---|
| **testo a pixel fissi** | 47 file, **857** occorrenze | la scala in centimetri veri del progetto |
| **`.gesti-pericolosi` che non va a capo** | 165 file di gesti in Lista spesa, 62 in Fatture | **una riga** in `index.css` |
| **tabelle senza riquadro che scorre** | 23 schermate | avvolte in `overflow-x-auto` |
| file di pulsanti e barre filtri senza `flex-wrap` | 19 file | `flex-wrap` |
| **testo senza classe di dimensione** | 18 casi, 5 schermate | la base tipografica nel `body` |

⚠️ **La seconda è la più istruttiva**: `.gesti-pericolosi` nasce il 22/08
per tenere 5 mm fra un gesto che cancella e uno che non si disfa. Era
`flex` **senza andare a capo**, e su un telefono spingeva la pagina fuori
dallo schermo. Il `gap` vale per entrambi gli assi, quindi andando a capo
**i 5 mm restano anche fra le righe**: la distanza di sicurezza non si
perde, si gira.

⚠️ **E l'ultima è quella che chiude alla radice**: non erano molti (18),
ma erano elementi con una classe di **colore** e nessuna di
**dimensione** — non c'era una classe da correggere. La cura sta nel
`body`, perché correggerli caso per caso vorrebbe dire trovarli tutti, e
il prossimo che scrive una riga senza classe ricomincerebbe.

### Il prima e il dopo, misurato

| schermata | testi < 3,20 mm | scorreva | adesso |
|---|---|---|---|
| HACCP tracciabilità | **3488** (min 2,19) | no | **0 · 0** |
| Calendario · sala e orari | 164 | no | **0 · 0** |
| Andamento mensile | 130 | 171 | **0 · 0** |
| Cassa · previsione | 116 | 88 | **0 · 0** |
| Editor menu · bevande | 113 | 15 | **0 · 0** |
| Calendario · clienti | 267 | 86 | **0 · 0** |
| Cassa · personale | 85 | **432** | **0 · 0** |
| Cassa · scontrinato | 39 | 366 | **0 · 0** |
| Agenda | 0 | **363** | **0 · 0** |
| Fatture fornitori | 0 | 368 | **0 · 0** |
| Magazzino · lista spesa | 0 | 293 | **0 · 0** |
| Calendario Eventi | 95 | 292 | **0 · 0** |
| Cassa · sconti e omaggi | 87 | 225 | **0 · 0** |
| Magazzino · allineamento | 0 | 135 | **0 · 0** |
| Magazzino · fornitori | 50 | 76 | **0 · 0** |
| Ricettario (8 schermate) | già a 0 da ieri | 0 | **0 · 0** |

**Le schermate del servizio — Comande, Cucina, Bar, Scontrini, Cassa,
Dashboard — erano già sane**, e lo sono rimaste.

**Misura finale su 23 schermate: zero testi sotto 3,20 mm e zero
scorrimento laterale, dappertutto.**

### Cosa NON è stato chiuso

I **bersagli fra 5 e 8 mm** nei moduli restano, per la decisione di ieri
(nessuno di loro cancella niente, ridisegnare i moduli è un lavoro a sé).
Fa eccezione la casella «fatto» dell'Agenda, corretta perché è il gesto
più frequente — vedi blocco 4.

---

## Blocco 3 — le prenotazioni in Dashboard

**Già a posto.** Creata una prenotazione vera per oggi sul progetto di
prova (20:30, 4 coperti, tavolo T4) e guardata la Dashboard:

> `20:30 · ZZ Prova Dashboard · 4 cop. · T4`

Orario, nome, coperti e tavolo, tutti e quattro. Il difetto che avevi
visto è chiuso dal rifacimento della Dashboard.

⚠️ E si vede anche il caso opposto: le altre prenotazioni di oggi dicono
**«da assegnare»**, che è un fatto e non un buco.

Prenotazione tolta **per identificativo**: zero rimaste, lapidi
invariate a **1797**.

---

## Blocco 4 — l'Agenda

**Misurato prima di toccare, come chiesto: il ridisegno approvato ad
agosto È STATO COSTRUITO.**

| voce del ridisegno | c'è? |
|---|---|
| quattro corsie (ritardo / settimana / più avanti / quando capita) | ✅ e le calcola il **database**, non la schermata |
| calendario come seconda scheda | ✅ |
| categorie chiuse | ✅ `TASK_CATEGORIES` |
| stella al posto delle priorità | ✅ |
| fatto con un tocco | ✅ |
| rimanda · promuovi a data | ✅ «rimanda» / «dagli una data» |
| ricorrenze che rigenerano | ✅ nella stessa transazione |
| badge solo ritardo e oggi | ✅ misurato: «Agenda **9**» con 8 in ritardo + 1 oggi |
| anzianità in «quando capita» | ✅ («in lista da 3 mesi») |
| **dettatura** | 🔴 **NO** |

🔴 **Manca solo la dettatura.** Nell'app esiste una schermata usa-e-getta
di prova (`/prova-voce`), non collegata all'Agenda. Era l'ultima voce del
ridisegno, e resta da fare.

### Dal telefono e dal tablet: regge

Zero testi sotto soglia, zero scorrimento, su entrambi.

🔴 **Ma il gesto più frequente era il bersaglio più piccolo**: la casella
«fatto» misurava **2,03 mm** — meno di un quarto della soglia — ed è
quella che chiude un impegno. ⚠️ **Non è una famiglia**: le caselle nude
erano **tutte e sole** in Agenda (23 su 23); nelle altre schermate stanno
già dentro un'etichetta toccabile. Messa dentro l'etichetta, adesso è
**8,5 mm** e il quadratino resta piccolo.

⚠️ **Una frase falsa nel codice**, trovata cercando il badge: un commento
in `tasks.js` dice *«il badge del modulo e la lista devono contare la
stessa cosa»* — ma **un badge del modulo non esiste**: `agendaCorsie` è
usata solo dalla schermata Agenda. Il badge che esiste è nel titolo della
pagina, e conta giusto.

---

## Blocco 5 — i moduli mai collaudati

Solo il giro, come chiesto. **Nessuna correzione.**

| modulo | com'è |
|---|---|
| **Ricerca Ricorrente** | segnaposto **dichiarato** («modulo non ancora sviluppato») — corretto così |
| **Monitoraggio Social** | idem |
| **Calendario Eventi** | funziona; misure a posto dopo il blocco 2 |
| **Comunicazioni ai clienti** | ✅ e dice bene la cosa difficile: *«Puoi scrivere a 0 — nessuno ti ha ancora detto che gli si può scrivere»*, con **66** che restano fuori e il perché uno per uno |
| **Agricolo / Orto** | ✅ dichiara che l'azienda **non è ancora attiva** e che si può già pianificare |
| **Personale & Buste Paga** | ✅ elenco dipendenti con mansione, contratto, stato |
| **Archivio Documenti** | ✅ misure a posto dopo il blocco 2 |

⚠️ **Niente di rotto, nessuna schermata vuota che non dovrebbe esserlo,
nessun numero implausibile.** Ma è un giro **di misura e di lettura**,
non un collaudo d'uso: nessuno ha *fatto* niente in quei moduli — non è
stata creata una coltura, non è stato aperto un dipendente, non è stata
mandata una comunicazione.

---

## Cosa NON è stato verificato con gli occhi

- 🔴 **Nessuna immagine, per tutta la consegna.** Lo screenshot non
  funziona in questo ambiente: **tutto** quello che è «visto» è misurato
  dal DOM. Non ho guardato come stanno adesso le righe che vanno a capo —
  so che entrano, non che siano belle.
- 🔴 **Nessuno ha stampato niente su carta**, e questa consegna decide una
  taglia di stampa.
- **Le 23 tabelle avvolte non sono state provate col dito**: so che il
  riquadro scorre, non che si scorra comodamente.
- **La dettatura** non è stata provata: ho solo constatato che in Agenda
  non c'è.
- Il **gesto «fatto»** dell'Agenda non è stato premuto dopo la modifica:
  è misurato a 8,5 mm, non provato.

## Cosa è stato dato per fatto senza misurarlo

- Che portare la **base tipografica** a 15,1 punti (da 16) non dia
  fastidio da nessuna parte: è **-6% su un computer**, e l'ho verificato
  come numero, non guardando le schermate una per una.
- Che le **file di gesti che ora vanno a capo** restino leggibili: ho
  misurato che non sborda niente, non che la riga resti chiara.
- Che i **bersagli a 8,5 mm esatti** contati come «sotto soglia» siano
  di fatto conformi (è l'arrotondamento del filtro `< 8.5`).
- Che il preconto a **3,2 mm** sia leggibile da un cliente seduto: è il
  mio parere motivato, non una prova.

## Affermazioni diventate false mentre lavoravo

- **«/comande sborda di 1046 punti»**, e altre cinque misure con lei:
  **false**, misurate su una finestra da 1265 punti invece che 390.
- **«Magazzino sborda di 283, Tracciabilità di 305»**: **false** — erano
  tabelle dentro un riquadro che scorre, e il mio misuratore non
  distingueva.
- **«Il badge del modulo Agenda»** di cui parla un commento nel codice:
  non esiste.
- Ho scritto nel commit del blocco 2 che restavano da chiudere
  «Magazzino allineamento e Lista della spesa»: **chiusi entrambi** nel
  commit successivo, poche ore dopo.
- La misura del manuale HACCP in stampa dava **7,94 mm** stamattina e
  **6,35** adesso: **non è un cambiamento**, è `md:text-3xl` contro
  `text-2xl` — la prima misura era su una finestra larga.

## Cosa abbiamo rovesciato

**Uno**, al numero **50** di
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md): «la taglia
di un documento stampato è quella dello schermo da cui lo stampi». ⚠️ La
regola delle misure in centimetri veri **non è rovesciata**: vale per lo
schermo, e finisce dove comincia la carta.

---

## Le migrazioni

**Nessuna.** Cinque blocchi di sola interfaccia: niente aspetta un ok,
niente cancella o modifica righe esistenti.

⚠️ **I dati di prova creati e tolti**, tutti per identificativo: un conto
con due righe inviate (per avere un ticket vero da misurare) e una
prenotazione per oggi. Zero rimasti, **lapidi invariate a 1797** prima e
dopo ogni pulizia.
