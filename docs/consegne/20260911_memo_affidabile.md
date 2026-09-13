# MEMO affidabile — 11/09/2026

Mandato notturno «MEMO affidabile», più la seconda parte decisa da Alessio
lo stesso giorno. Tre obiettivi:
- **(A)** MEMO voce raggiungibile da ogni modulo, col ritorno al punto di
  partenza;
- **(B)** una dettatura con più appuntamenti, ognuno una proposta a sé;
- **(B2)** la protezione dell'Agenda con la **variante (a)**, e l'**ora**
  nel vero campo Ora dell'Agenda.

**Migrazioni**: `20260911000001` (`l_ora_e_le_frasi_miste`) e
`20260911000002` (`l_ora_va_da_zero_a_ventitre`), applicate **solo al
progetto di prova**. **In produzione: niente.**
**Funzioni online**: `ascolta-voce` installata **solo sulla prova**
(versione 32 → 33 → 34). **In produzione: niente.**
**HEAD dichiarato**: vedi l'ultima riga.

---

## A. MEMO voce da qualunque modulo

**Cosa cambia**
- `src/components/ApriMemo.jsx` (nuovo): pulsante «MEMO» nella **testata** di
  telefono e tablet (`Layout.jsx`, accanto al menu, stacco 0,3 cm veri). Solo il
  titolare (la rotta è `RequireTitolare`), assente in MEMO stesso.
- **Apre, non registra**: «Premi e parla» resta uno solo, in MEMO. Il browser
  apre il microfono solo dentro un tocco sulla pagina che lo usa.
- **Sul computer** la porta è la voce «MEMO voce» in cima alla barra laterale,
  che porta con sé la stessa partenza (`Sidebar.jsx`).
- La partenza viaggia nello **stato della cronologia** (`history.state.usr.da`).
  `src/lib/calcoli/ritornoMemo.js` (nuovo, puro): `origineValida` accetta solo
  percorsi interni — mai `//…`, schemi, `\`, `/detta`, `/login`;
  `statoVersoMemo` riconsegna la partenza se si ritocca «MEMO voce» da dentro
  MEMO; `ritornoDaMemo` dà le parole col nome del modulo preso da `MODULES`.
- `Detta.jsx`: in cima «← Torna in {modulo}»; **a microfono acceso** «← Annulla
  e torna in {modulo}», che smonta la pagina, ferma il riconoscitore e **non
  manda niente**. Dopo il riscontro, un pulsante di ritorno con la frase «Gli
  appunti restano da approvare».
- ⚠️ **Nessun ritorno automatico** (il riscontro alla fine è una decisione del
  25/08) e **nessun contesto del modulo verso la voce** (la stessa frase non
  deve cambiare significato a seconda di dove si è premuto).

**Misure dal vivo** (Chrome senza schermo, gestionale di questo ramo collegato a
Borgo58-Prova), partenza da Cassa → Prima nota, Agenda, Magazzino, Dashboard:

| forma | pulsante alto | largo | stacco dal menu | testata/pagina scorrono | ritorno giusto (anche dopo ricarica) |
|---|---|---|---|---|---|
| iPhone 390 | 8,50 mm | 20,6–20,8 mm | 3,00 mm | no / no | 4/4 |
| iPhone 64 p/cm | 8,50 mm | 16,2–16,5 mm | 3,00 mm | no / no | 4/4 |
| computer (barra laterale) | 8,50 mm | — | — | — / no | 4/4 |

## B. Più appuntamenti nella stessa dettatura

- **Il contratto è un elenco di azioni** (`ascolta-voce/index.ts`, «UNA FRASE
  SOLA, PIÙ AZIONI … Non fonderle mai»); `scrivi_dettatura` scrive una riga per
  azione; `promemoria` non è additivo → **un appunto per impegno**.
- **Dashboard**: la riga «N appunti aspettano…» si apre e mostra le stesse
  schede di MEMO (`AppuntiInDashboard.jsx`): Approva, Fallo a mano (=
  correggere), Butta. `src/lib/useGestiAppunti.js` porta guardia ed esito,
  condivisi con MEMO; buttato non è fatto.
- **Corretto**: il riscontro non teneva il numero della dettatura (rilettura
  senza numero → `PGRST202`), e una scelta riuscita si diceva fallita.

## B2. La protezione dell'Agenda (variante a) e l'ora

### Il difetto, misurato prima
- La rete (`correggiAgenda`, dall'08/09, `066f263`) passava **la frase intera** a
  ogni azione. Dal vivo: tre appuntamenti + «e sposta a venerdì l'ordine delle
  verdure» → i tre appuntamenti nuovi diventavano `agenda_quale_impegno`.
- **Il caso peggiore, misurato** sulla prova con righe proprie: se in Agenda
  c'era un impegno omonimo, l'appunto trasformato era approvabile e
  approvandolo l'impegno esistente passava dal 21/10 al 28/10 — il nuovo non
  nasceva.
- L'ora dell'impegno non era nel contratto: il modello la metteva nella
  **descrizione** («Alle 10»), e `fai_azione_dettata` scriveva solo `due_date`.

### La regola nuova (`ascolta-voce/agenda.ts`, `correggiAgenda`)
- Al modello si chiede, per **ogni** azione, un `pezzo`: le parole della frase
  che riguardano solo quella cosa, **copiate**. Non si scrive nel database:
  serve a decidere.
- `pezziSeparati`: la separazione è **certa** solo se ogni azione ha un pezzo
  detto davvero (parole intere e di seguito nella frase normalizzata, **una
  volta sola**), i pezzi non si sovrappongono, e con più cose nessun pezzo è la
  frase intera. Si guardano **tutte** le azioni, anche quelle non d'Agenda: la
  parola «sposta» deve poter essere attribuita a qualcuno prima di decidere del
  dentista.
- Senza parole di spostamento o chiusura nella frase non si decide niente (il
  caso dei tre appuntamenti). Con una sola cosa detta, le parole sono il suo
  pezzo o la frase intera (come prima). Con più cose e separazione certa, ogni
  azione si decide **sulle sue parole**.
- 🔴 **Altrimenti ogni azione d'Agenda diventa `agenda_da_chiarire`**: fuori dal
  catalogo, quindi **non approvabile per costruzione**, con il motivo scritto e
  «Fallo a mano →» verso l'Agenda.
- 🔴 **Uno spostamento o una chiusura restano approvabili solo se le parole
  dette per quella cosa li dicono**, in **qualunque** frase, mista o no
  (rilievo della seconda revisione). Se il modello li dichiara e le parole no,
  diventano «da chiarire», col motivo che dice di ridirlo con «sposta» o
  «segna fatto». È la forma esatta in cui un appuntamento nuovo diventerebbe
  lo spostamento di uno vecchio. Un «quale impegno?» dato dal modello resta
  fermo allo stesso modo.
- ⚠️ **Non si usa `agenda_quale_impegno`**: quello, quando porta un gesto, il
  database lo ritraduce cercando in Agenda e con un candidato solo lo rende
  approvabile.
- Le parole della rete si cercano **intere**: «le spuntature di maiale» non è
  più «spunta».

### L'ora (`20260911000001`, dai corpi vivi della prova)
- `voce_risolvi_dati`: `ora` si normalizza a `HH:MM` («9:30» → «09:30»); quella
  che non si legge («verso sera», «25:00») esce da `ora` e resta visibile come
  `ora_non_capita` — non si scrive, e l'appunto resta approvabile.
- `fai_azione_dettata`: scrive `tasks.due_time`; un'ora illeggibile si rifiuta
  **prima** di scrivere (chi scrive non si fida di chi chiama).
- `azione_campi`: l'ora arriva al modulo di «Fallo a mano»; `TaskForm` la mette
  in `due_time`.
- `azione_percorso`: `agenda_da_chiarire` → `/agenda`.
- Prompt: `ora` solo se è stata detta un'ora precisa («mattina» non è un'ora), e
  non ripetuta nella descrizione.
- La scheda mostra «ora: 10:00» accanto al giorno, e «ora non capita (non la
  scrivo)» quando serve.
- ⚠️ **Come è stata costruita la migrazione**: uno script prende i quattro corpi
  vivi della prova (allineata al repository: ultima `20260910000003`) e fa **solo
  sostituzioni esatte, contate**. Il confronto riga per riga col corpo vivo
  mostra soltanto le righe dell'ora e di «da chiarire». Nessun `grant`
  riscritto: `create or replace` con la stessa firma li conserva.
- 🔴 **Un difetto dello script, preso dal suo stesso controllo**: in una
  sostituzione JavaScript `$'` vuol dire «il resto del testo», e l'espressione
  dell'ora finisce con `?$'`. Il conteggio delle occorrenze l'ha fermato sul
  secondo punto; sul primo avrebbe **incollato di nuovo tutto il resto** di
  `voce_risolvi_dati` senza nessun errore. Corretto sostituendo con una
  funzione, e con un controllo sulla lunghezza.

## Come è stato verificato

- **Prove pure**: giro completo **1334 verdi, 1 rossa** — `indice-richieste`,
  fine riga di Windows, la stessa misurata su master prima di cominciare
  (`indice-rovesciamenti`, rossa su master qui, passa dopo aver rigenerato
  l'indice). Nella rete dell'Agenda **50 prove**, **rotte due volte apposta**:
  con la regola dell'08/09, **14 rosse**; con quella di prima della seconda
  revisione, **4 rosse** (le quattro dello spostamento dichiarato senza
  parole). Rimessa la regola finale, 50/50. Nuove anche `ritorno-memo` (15).
- **Prove schermata**: **156/159**; le 3 rosse sono `rotte-chiuse` ×1 e
  `varco-pubblico` ×2, «Test timed out in 5000ms», **identiche su master
  `59f4d2d`** fatto girare nelle stesse condizioni; da sole 12/12. Nuove:
  `memo-lanciatore` (12), `dashboard-appunti` (7), `memo-tre-appuntamenti` (8:
  tre schede con ore diverse, approvazione e scarto indipendenti, la scheda da
  chiarire senza «Approva», le quattro gare fra scrittura e rilettura).
- **Migrazioni**: la verifica di ciascuna, lanciata **da sola sulla prova
  prima di applicare**, si è fermata al primo controllo («9:30» non diventa
  «09:30»; «24:00» resta come ora); applicate, passano. Il progetto di prova
  ha 389 migrazioni registrate.
- **Contro Borgo58-Prova, senza modello** — 10 file, **97/97**: i nuovi
  `tre-appuntamenti` (ore 10:00, 15:30 e nessuna; l'ora nel campo `due_time`;
  «Fallo a mano» porta l'ora; approvare, correggere e buttare uno non tocca gli
  altri) e `frase-mista` (l'appuntamento nuovo crea un impegno **nuovo** e
  l'omonimo che c'era **non si muove**; lo spostamento sposta solo il suo; «da
  chiarire» non si approva, non muove niente, e resta aperto), più tutti quelli
  già esistenti su voce e Agenda.
- **Col modello vero** (`tests/app/memo-dal-vivo.test.js`, esclusa da sola dal
  giro di ogni proposta perché si paga; lanciata apposta con `--col-modello`):
  **2/2, due volte** (funzione v33 e v34) — tre appuntamenti → tre promemoria
  con ora `10:00`, `15:30` e **nessuna** («mattina»); frase mista → i due
  appuntamenti nuovi restano promemoria con la loro ora, lo spostamento resta
  a sé.
- **Dal vivo nel browser**: pulsante e ritorno 12/12, Dashboard con tre appunti.
- **Lint** pulito, **compilazione** riuscita.
- **Revisione Codex del diff**: vedi la sezione qui sotto.

## Revisione Codex

**Prima parte** (una revisione): tre rilievi, tutti curati, più un quarto
preesistente; per ognuno una prova scritta **prima** della cura, **4 rosse su 4**
sul codice non curato, poi verdi:
1. la guardia contro il doppio tocco si liberava prima che la rilettura
   tornasse;
2. in Dashboard una lettura vecchia poteva riportare schede già chiuse;
3. in MEMO una rilettura rimasta indietro poteva sovrascrivere il riscontro di
   una dettatura nuova;
4. (preesistente) l'esito di una scelta finiva sotto l'elemento, dove la scheda
   non guarda.

**Seconda parte** (una revisione): due rilievi, **tutti e due veri** e curati.
1. 🔴 **Critico, e preesistente**: in una frase **senza** nessuna parola di
   spostamento o chiusura, lo spostamento **dichiarato** dal modello passava
   così com'era. «Ricordami il dentista lunedì» capito come lo spostamento di
   un impegno «dentista» sarebbe diventato, con un omonimo in Agenda, uno
   spostamento approvabile. Ora uno spostamento o una chiusura restano
   approvabili **solo se le parole dette per quella cosa li dicono**, in
   qualunque frase; altrimenti diventano «da chiarire» con un motivo che dice
   quali parole usare. Anche un «quale impegno?» dato dal modello resta fermo.
   Prova: `agenda-a-voce.test.js`, «su tutta la filza» (cinque casi nuovi).
2. **Medio**: «24:00» passava il controllo della forma e PostgreSQL la
   accetta come ora. Curato con una migrazione **nuova** (`20260911000002`,
   ore 00-23 e minuti 00-59 scritti), perché una migrazione applicata non si
   riscrive — anche se era andata solo sulla prova. La sua verifica, lanciata
   da sola prima di applicare, si è fermata su «24:00»; applicata, passa.
   ⚠️ Il controllo dell'**avviso** (`avviso_ora`, dal 10/09) ha la stessa forma
   e non è toccato: non era nel perimetro.

## Cosa NON è verificato

- **In produzione non c'è niente** di questa consegna: la migrazione e la
  funzione vanno applicate dopo il merge, nell'ordine di sempre (push →
  `npm run migra -- --conferma` → `npm run funzione ascolta-voce -- --conferma`),
  con i numeri veri scritti nel riepilogo di quel giorno.
- **Safari e un iPhone vero**: niente è stato aperto da un telefono.
- **Il modello è stato chiamato poche volte** (2 giri della prova + 2 dettature
  la mattina): è un modello, e due giri della stessa frase la mattina avevano
  dato giorni diversi (14/15/16 e 15/16/17 settembre). La data e l'ora si vedono
  sulla scheda prima di approvare.
- **Il caso «da chiarire» non si è potuto far nascere dal modello vero**: si
  prova sulla regola (prove pure) e sul database (`frase-mista`), non su una
  frase detta.
- **Un'avvertenza di sicurezza**: durante il lavoro un errore di avvio di `psql`
  ha stampato nel registro della sessione la stringa di collegamento del
  database **di prova**, password compresa. Riguarda solo Borgo58-Prova; lo
  script è stato corretto (il collegamento passa solo nell'ambiente, gli errori
  si stampano per messaggio). Si cambia dal pannello Supabase del progetto di
  prova → Database → reimposta la password, aggiornando poi `DB_URL_PROVA` in
  `.env`.

## Limiti che restano, dichiarati

- **Più attrito dove prima c'era un rischio**: se in una frase mista il modello
  non restituisce i pezzi, **tutte** le cose d'Agenda restano da chiarire, anche
  quelle che avrebbe capito bene. È il verso scelto da Alessio: si ridice o si fa
  a mano, non si sposta mai un impegno per sbaglio.
- **Due spostamenti che condividono un verbo** («sposta a venerdì il dentista e
  la riunione»): il secondo pezzo non contiene «sposta», quindi resta da
  chiarire.
- Le parole di spostamento e chiusura sono un elenco: un verbo che non c'è
  («anticipa a giovedì la riunione») **non basta più da solo** — resta da
  chiarire, e si ridice con «sposta» o si fa a mano. Prima lasciava decidere
  il modello; è il prezzo della regola «mai spostare al posto di creare».

## Cosa abbiamo rovesciato

- **n. 92** — «la rete dell'Agenda guarda la frase detta intera» (08/09,
  `066f263`). *La ragione di allora vale ancora* — il modello riconduce una
  chiusura o uno spostamento alla cosa più vicina che conosce — e la rete resta;
  cambia **su quali parole** decide. Per esteso in
  [`decisioni_rovesciate.md`](../decisioni_rovesciate.md). Il numero è 92 e non
  91 perché il 91 è nella PR #57, non ancora unita.
- **Non rovesciato**: la regola del 07/09 «si guardano le parole dette, non un
  riassunto del modello». Il pezzo vale solo se è una **copia esatta** della
  frase detta; al modello si chiede soltanto dove tagliare.
- **Non rovesciata**: «l'ora non si inventa» (`TaskForm.jsx`, dal 27/08). Resta
  intera: l'ora entra solo quando è stata detta.
- La riga della Dashboard **era un collegamento a MEMO** e ora **si apre**. Non
  c'era una decisione «si approva solo in MEMO»; la ragione accanto a quella
  riga — contare gli appunti e non le righe — vale ed è conservata.

---

**Hash di HEAD dichiarato**: `9518e7f` sul ramo `memo-affidabile`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
