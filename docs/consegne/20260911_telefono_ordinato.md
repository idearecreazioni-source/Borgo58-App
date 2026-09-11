# Il telefono ordinato — 11/09/2026 (mandato notturno)

Sola interfaccia, tre ambiti: SPEC-0010 (campi data/ora e filtri sul telefono),
il segno «?» delle didascalie, il collegamento Cassa → Comande.

**Migrazioni**: nessuna. **Funzioni online**: nessuna. **Database**: non
toccato (lo strumento di misura legge soltanto, e solo dal progetto di prova).
**HEAD dichiarato**: vedi l'ultima riga.

---

## Il metodo: prima misurare, poi correggere

Il mandato chiedeva di **non dichiarare difettosa una schermata senza averla
misurata**. Da qui `npm run misura:telefono` (`scripts/misura-telefono.mjs`):
apre il vero gestionale collegato **solo a Borgo58-Prova** (si ferma se
l'indirizzo non è quello), entrato come titolare di collaudo con le
credenziali di `.env` (mai stampate), e visita 37 schermate a **iPhone 390**,
**iPhone a 64 punti per cm** e **computer**. Per ognuna misura sbordi della
pagina, campi fuori dal riquadro, date/ore più strette del loro contenuto,
sovrapposizioni, etichette staccate dal campo e — sulle righe della regola
nuova — campi che non cominciano alla stessa altezza e gesti accanto ai campi
sul telefono. Fotografa tutto in `%TEMP%/b58-misura-telefono/`.

⚠️ **Le preparazioni aprono moduli e attivano filtri, mai «Salva».** La Lista
della spesa è fuori elenco (all'apertura può scrivere righe); quattro schermate
salvano al tocco di un campo (Sala e orari, preventivo, deducibilità,
«rimanda») e lì lo strumento misura senza toccare.

🔴 **Il misuratore ha sbagliato tre volte, e ogni volta l'ha scoperto un caso
di cui si conosceva già la risposta** (regola del 26/08):
- confrontava con `innerWidth`, che sul telefono **si allarga insieme alla
  pagina** quando qualcosa sborda: la spiegazione del «?» andava da 342 a 598
  su uno schermo da 390 e la prova la dava «dentro». Ora il confronto è con la
  larghezza dello schermo (`clientWidth`) — in tutti e tre i misuratori;
- una pagina ancora bianca (lunghezza zero, ferma) sembrava «pronta»;
- i pulsanti scritti come testo (`tocco-testo`, margine negativo voluto)
  risultavano «fuori» di 8 punti, e un'etichetta usata come titoletto di
  sezione veniva abbinata alla casella sbagliata.

🔴 **E lasciava Chrome acceso.** Su Windows `kill()` chiude solo il processo
principale: dopo una notte di prove erano rimasti **96 processi di Chrome
senza schermo, quasi 13 GB**, e il sistema ha fermato il secondo censimento
per mancanza di memoria. Ora si chiude l'albero intero (`taskkill /T`), e dopo
ogni giro ne restano **zero** — contato, non supposto.

## Ambito 1 — SPEC-0010: la regola comune

**Il difetto, misurato prima di correggere** (primo giro, 111 viste): in 16
schermate le date nelle griglie a due colonne avevano **fra 132 e 192 punti**
e ne chiedevano **181** (fino a **260** a 64 punti per cm) — Chrome le taglia,
Safari le fa uscire. Fatture Fornitori: la barra dei filtri andava a capo dove
capitava («Dal» da solo, «Al» con «Togli i filtri» accanto; a 64 tutto in
colonna).

**La cura** sta in `index.css`, una volta sola:
- `riga-campi` — le celle in fila, a capo quando non ci stanno, **allineate in
  alto** (etichetta sopra campo: campi alla stessa altezza anche quando una
  cella ha una frase sotto, come la «Giornata»);
- `campo-data` 11,5 em e `campo-ora` 7,5 em — larghezza **dichiarata sul
  testo del campo**, non lasciata al browser. Misurato: una data chiede ≈11,3
  volte la sua grandezza di carattere, un'ora ≈7 (col margine interno dei
  campi normali);
- `cella-larga` (testo, menu) e `cella-media` (cifre: due stanno affiancate
  anche sul telefono);
- `riga-campi-gesti` — «Togli i filtri», «Azzera», «Registra»: sul telefono su
  una riga loro, dal bordo sinistro dei campi; da 640 punti in fondo alla riga.

⚠️ **I campi non diventano enormi**: sul telefono una data è larga quanto la
sua data (≈184 punti su 326), non tutta la riga. Si allarga solo chi ha testo
da mostrare.

### Censimento, schermata per schermata

| schermata | prima (misurato) | adesso |
|---|---|---|
| Fatture Fornitori — filtri attivi | a capo «dove capita» | corretta |
| Fatture Fornitori — nuova fattura | date 138 su 181/217 | corretta |
| Fatture Fornitori — nota di credito | data 160 su 181/217/161 | corretta |
| Prima nota — nuovo movimento e filtri | «Giornata» 132 su 181/217 | corretta |
| Sconti e omaggi | «Giornata» 132 su 181/260 | corretta |
| Sezione personale (anticipi) | «Quando» 132 su 181/260 | corretta |
| Ce la faccio? | «Scade il» 132 su 181/260 | corretta |
| Prenotazioni — nuova | data 147 su 181/260, ora a 64 | corretta |
| Preventivo — dettaglio | date 149 su 181/260, ora a 64 | corretta |
| Prenotazione pubblica | data 192 su 260 a 64 | corretta |
| Registra carico | scadenza 147 su 181/217 | corretta |
| Deduzioni — nuova spesa | data 132 su 181/260 | corretta |
| Catalogo strumenti — nuovo | due date 132 su 181/260 | corretta |
| Dipendente — scheda | scadenza 138; mese 284 su 289 a 64 | corretta |
| Archivio documenti — nuovo | due date 132 su 181/260 | corretta |
| Agricolo — nuova coltura | due date 156 su 181/260 | corretta |
| Cessioni agricole — nuova | data 140 su 181/260 | corretta |
| Andamento mensile — periodi | a 64 «perché» fuori di 37 | corretta |
| Sala e orari — chiusure | a 64 un menu fuori di 14 | corretta |
| Cassa (cassetto), Incassato e scontrinato, Prestiti, Prenotazioni (elenco), Pianta, Allineamento, Cantina, Manuale HACCP, Raccolta propria, Menu nuovo, Piatti del giorno, Simulatore, Deducibilità, Documento | nessun difetto misurato | **già corrette, non toccate** |
| Agenda — nuovo impegno | nessun difetto (collaudata su iPhone l'11/09) | non toccata |
| Mance | le date sono corrette; a 64 punti per cm il pulsante «Rimuovi» dell'elenco delle raccolte si leggeva «Rimuc» | **corretta** (autorizzata da Alessio dopo il primo resoconto) |
| Produzioni, Fermi | sul progetto di prova non c'è una preparazione né una partita | **non misurate** |

**Il secondo censimento, dopo le correzioni** — tutte le 37 schermate nelle
tre forme, in più giri perché il primo è stato fermato per memoria (vedi
sopra): **ogni schermata misurabile è corretta**. Due
correzioni sono nate proprio da questo giro:
- il **mese** delle buste paga (scheda Dipendente) chiede circa 12 volte il
  suo testo, non 11,3 come una data: 196 punti su 184 al telefono, 239 su 236
  a 64 punti per cm. Da qui `campo-mese` a 12,5 em, e la riga prende la misura
  dei campi secondari sul telefono;
- il menu **«In cucina si lavora?»** di Sala e orari restava largo quanto «No,
  nemmeno in cucina» — lì la classe dei campi non porta `w-full` — e a 64
  usciva ancora di 14 punti.

**Mance, corretta dopo il primo resoconto** (autorizzata da Alessio). Il
pulsante «Rimuovi» porta `tocco-bottone`, che fissa una larghezza minima: in
una fila quel minimo prende il posto di quello naturale, e il testo accanto lo
schiacciava sotto la sua parola — l'elenco scorre in verticale e tagliava il
resto («Rimuc»). Il testo si stringe e va a capo (`min-w-0 flex-1`), il
pulsante no (`shrink-0`). Rimisurata nelle tre forme: corretta.

⚠️ **Fuori perimetro, contate a parte**: campi e pulsanti dentro **tabelle
che scorrono di lato** nel loro riquadro (Deduzioni, Deducibilità, Agricolo,
Dipendente) — è la famiglia di `ElencoAdattivo`, non dei campi data/ora.

⚠️ **L'Agenda non è stata portata sulla regola comune**: la sua scheda,
collaudata e approvata su iPhone poche ore prima, ha una regola locale che
ottiene lo stesso effetto (celle larghe quanto il contenuto con un minimo in
cm). Unificarla le cambierebbe le misure (a 64 punti per cm la data da 202 a
235): è una decisione da prendere, non una pulizia.

## Ambito 2 — il segno «?»

**42 usi in 29 file.** Misurati coi gesti veri — il tocco passa dal
protocollo di Chrome (`Input.dispatchTouchEvent`), non da clic sintetici —
su una pagina di prova (`tests/visive/didascalia/`) con i casi del gestionale:
accanto a un titolo, contro il bordo destro, dentro l'etichetta di una
casella, vicino a un pulsante, in una pagina che scorre.

**Prima delle correzioni** tutti i gesti richiesti funzionavano già in Chrome
(primo tocco apre, secondo chiude, tocco fuori chiude, il pulsante accanto
riceve il suo tocco, trascinare fa scorrere senza aprire; mouse sopra apre,
clic non richiude, uscita chiude; Tab apre, Escape chiude). **Tre difetti
veri**:
- 🔴 **accanto al bordo destro la spiegazione usciva dallo schermo** (da 342
  a 598 su 390) e la pagina si allargava e scorreva di lato. Ora la posizione
  si decide **al gesto, prima di disegnare**: spostarla dopo averla disegnata
  (prima stesura) la rimetteva dentro ma la pagina restava larga 598;
- 🔴 **MEMO voce** passava il testo come `testo="…"`, che il componente non
  legge: la spiegazione si apriva **vuota**;
- ⚠️ il tipo di gesto del clic si prende dalla **pressione** (`pointerdown`),
  che lo dichiara in ogni browser; il clic lo porta solo dove è un evento del
  puntatore. **Non riprodotto in Chrome**: è la cura della variabilità che ha
  già rotto questo segno due volte (23 e 24/08).

Verificato anche il caso dell'etichetta: toccare il «?» dentro l'etichetta di
una casella **non la spunta** (dito e mouse).

## Ambito 3 — Cassa → Comande

**Tolto il pulsante «Comande» da Cassa, Banca e Prima nota** (era l'unico:
Prima nota e conti correnti non ne avevano). Il menu laterale non è toccato.

**Perché c'era**: nato il 04/08 come `/cassa/comande`, quando le Comande
erano una pagina dentro Cassa (`63d42cb`); il 05/08 sono diventate uno schermo
a sé con la voce nel menu (`bc798eb`) e il pulsante è stato solo ripuntato.

⚠️ **La «vista Sala diversa» non l'ho riprodotta.** Misurato sul progetto di
prova, a iPhone 390 e al computer: le due strade aprono la **stessa rotta**
(`/comande`), lo **stesso componente**, **in cima alla pagina**, con lo stesso
contenuto — anche partendo da Cassa scesa di 694 punti. La Sala non legge
l'indirizzo, la memoria del browser né lo stato della navigazione. Il sospetto
dello scorrimento conservato è smentito dalla misura (la Sala nasce corta e
riparte da zero). **Serve la fotografia della vista diversa** per dire di più.

**Altri collegamenti verso Comande** (elencati, non toccati): solo la
navigazione interna delle postazioni — Sala → Bar, Cucina, Scontrini; Bar →
Sala, Cucina; Cucina → Sala, Bar; Scontrini → Sala. Sono coerenti.

## Come è stato verificato

- `npm run misura:telefono` — due giri completi (prima e dopo), più giri
  mirati durante il lavoro.
- `npm run test:visive` — Agenda (18 schede) e segno «?» (14 gesti col dito
  per forma di telefono, 6 con mouse e tastiera): **verde**.
- `tests/unita/didascalia.test.js` — le due regole nuove, anche nelle
  sequenze intere.
- Revisione indipendente del diff: nessun difetto reale.
- Lint pulito, compilazione riuscita.
- Prove pure **1303/1304**: la rossa è `indice-richieste`, **identica su
  master `59f4d2d`** — provata in una copia separata di master, perché questa
  serviva al censimento.
- Prove sulle schermate **129/132**: le tre rosse (`rotte-chiuse` ×1,
  `varco-pubblico` ×2) sono **le stesse su master**, misurato nello stesso
  modo.

## Cosa NON è verificato

- **Safari su iPhone**: tutte le misure sono Chrome. Safari disegna data e
  ora a modo suo (niente icona, larghezza sua): le larghezze dichiarate
  coprono quello che chiede Chrome, che ha l'icona; il collaudo vero resta
  sull'iPhone.
- **Produzioni e Fermi**: senza dati sul progetto di prova.
- **La Lista della spesa**, **la Posta in arrivo** (righe di carico) e **i
  campi della prenotazione dentro la Pianta** (dietro il tocco su un tavolo):
  non raggiunti dallo strumento.
- **La vista Sala diversa da Cassa**: non riprodotta.
- Le etichette esplicite proposte da SPEC-0010 («Scadenza: data», «Avvisami
  il») non erano nel mandato e non sono state toccate.

## Cosa abbiamo rovesciato

- **n. 91** — «`min-w-0` tiene la data dentro la sua colonna» (12/08,
  `f93ecca`). *La ragione vale ancora* — la data non deve uscire né coprire il
  vicino — ed è rispettata; era sbagliata la cura, che la stringeva sotto il
  suo contenuto. Prezzo: sul telefono due date vanno una sotto l'altra.

---

**Hash di HEAD dichiarato**: `3b2e825` sul ramo `telefono-ordinato`, cioè il
commit immediatamente sotto questo aggiornamento del documento (la prima
stesura dichiarava `7bce7e4`; dopo è arrivata la correzione di Mance).
**Stato del working tree al momento della consegna**: pulito.
