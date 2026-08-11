# Consegna del 12/08/2026 — la posta in arrivo nell'Archivio Documenti

**Commit della consegna: `7f62812`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `7f62812` | funzioni `posta-in-arrivo` e `posta-leggi`, migrazione `20260812000002` (conferma atomica + lettura pianificata), schermata, corridoio |
| `5ac79c5` | migrazione `20260812000001`: dove la posta atterra, chi la vede, per quanto resta |
| `b67a036` | regola di Alessio: i dati di prova si cancellano subito dopo |

**Da applicare in produzione**: `20260812000001`, poi `20260812000002`.
**Da installare**: `posta-in-arrivo`, `posta-leggi`, e il **ridispiegamento
di `operazioni-atomiche`** (elenco allargato). **Non ancora provato dal
vivo**: manca l'impostazione degli inoltri — vedi §6.

---

## 1. Il vincolo che ha deciso l'architettura

`info@borgo58.it` deve continuare ad arrivare ad Aruba: il record MX
della radice **non si tocca** (è la trappola documentata in
`docs/DOMINIO.md` §7, dove è già scritto perché non abbiamo aggiunto l'MX
di ricezione proposto da Resend).

Quindi la posta non viene *dirottata*: viene **copiata**. Aruba inoltra
una copia a un indirizzo su un sotto-dominio dedicato, che è l'unico posto
dove il servizio di ricezione ha i suoi record. La casella vera resta
intatta, e se domani spegniamo tutto questo, non cambia niente per chi
scrive al locale.

---

## 2. Le tre decisioni della prima migrazione

1. **La posta non diventa un documento da sola.** Entra in una sala
   d'attesa con accanto una proposta e ci resta finché Alessio non
   conferma. È la regola che ha posto lui prima ancora che il modulo
   esistesse: *il sistema propone, io confermo*.
2. **Entra tutto, quindi si cancella da solo.** Nessun filtro
   all'ingresso (sua decisione): significa che entrano anche pubblicità e
   messaggi personali. Ciò che non diventa un documento sparisce dopo
   **3 mesi** — numero in `service_settings`, non nel codice.
3. **Il mittente è un dato personale.** Tabelle titolare-only, e la
   cancellazione **non passa** dal registro delle cancellazioni, che
   conserverebbe una copia integrale della riga rendendo finta la
   cancellazione. Stessa tensione risolta il 10/08 per le richieste dei
   clienti, stessa soluzione.

`messaggio_id` è `UNIQUE`: i servizi di posta ritentano la consegna se non
rispondiamo in fretta, e senza vincolo ogni ritentativo sarebbe una
fattura in più da esaminare. È anche il freno all'unico varco nuovo aperto
verso l'esterno.

---

## 3. Consegna e lettura sono separate — e non per eleganza

Chi consegna si aspetta una risposta in pochi secondi e **riprova** se non
la riceve. Legare la consegna alla chiamata all'AI significherebbe, nelle
giornate storte, pagare tre volte la stessa lettura. Quindi:

- `posta-in-arrivo` registra e risponde;
- `posta-leggi` viene chiamata da `pg_cron` ogni quarto d'ora, e
  `chiedi_lettura_posta()` **non chiama nemmeno la funzione** se non c'è
  niente da leggere.

**Modello piccolo** (`claude-haiku-4-5`), con il prezzo della scelta
dichiarato nel codice: entra anche la pubblicità, il lavoro è
riconoscimento e non ragionamento, e su una fattura scritta male un
modello piccolo sbaglia più spesso — accettabile **solo** perché nessuno
di quei numeri diventa un dato del gestionale senza che Alessio lo guardi.
Se un giorno la conferma diventasse automatica, quella riga va riaperta
prima di quella. Freno a **10 messaggi per giro**.

---

## 4. La conferma è atomica, e il motivo non è teorico

Confermare sono tre scritture: nasce il documento, nasce il promemoria
della scadenza, la mail esce dalla sala d'attesa. Regola **B4**: una
funzione, una transazione, e si passa dal corridoio.

- documento creato **e** mail ancora aperta → al secondo tocco due
  documenti identici nell'Archivio;
- mail chiusa **e** documento non creato → fattura persa, e nessuno se ne
  accorge perché risulta «archiviata».

`archivia_posta` è idempotente per costruzione: rieseguita sulla stessa
mail restituisce il documento già creato. Provato nella migrazione **dal
ruolo vero del titolare** (impersonazione via `request.jwt.claims`),
doppio tocco compreso, con pulizia completa della prova.

**Il file non si copia**: l'allegato è già nel bucket dell'Archivio sotto
`posta/`, e il documento punta a quello. Due copie dello stesso file
diventano prima o poi due verità diverse.

---

## 5. Il varco nuovo verso l'esterno

`posta-in-arrivo` è **pubblica per forza**: la chiama un servizio, non un
utente, quindi la verifica JWT del gateway è spenta. L'unica barriera è la
firma sulla consegna:

- verificata **prima** di leggere qualunque cosa del corpo;
- **confronto a tempo costante** — un confronto normale si ferma al primo
  carattere diverso, e dalla durata si indovina la firma un carattere
  alla volta;
- **consegne più vecchie di 5 minuti rifiutate**, altrimenti una firma
  valida resterebbe valida per sempre e una consegna intercettata si
  potrebbe rigiocare;
- nome degli allegati ripulito: arriva da fuori e potrebbe contenere
  percorsi.

Usa la chiave di servizio, che Supabase inietta da sé nelle funzioni: non
sta nel repository e non passa dal client. È la prima funzione del
progetto che la usa, e la ragione è che qui **non esiste un utente** di cui
usare il token.

---

## 6. Stato di verifica — onesto

| Cosa | Stato |
|---|---|
| migrazioni | **applicate e verificate sul progetto di prova**, non in produzione |
| conferma atomica dal ruolo del titolare | **provata** dentro la migrazione, doppio tocco compreso |
| revoche sui permessi delle funzioni nuove | **verificate** (né `anon` né `authenticated`) |
| lint | pulito |
| ricezione di una mail vera | **mai provata**: mancano gli inoltri e il ridispiegamento |
| lettura dell'AI su una mail vera | **mai provata** |

**Nessuna riga di questo modulo ha ancora visto una mail vera.** È scritto
e provato nella sua logica; diventa «fatto» quando una fattura arriva a
`info@`, compare nella schermata e con un tocco è nell'Archivio.

---

## 7. Cosa manca, e chi lo fa

**Alessio**: creare il sotto-dominio di ricezione presso Resend con i suoi
record DNS, impostare l'inoltro da `info@` e dalle due PEC, mettere il
segreto del webhook nei Secrets, installare le due funzioni e
ridispiegare il corridoio.

**Deciso stanotte, e diverso dal resto**: dalla casella Gmail del
gestionale **non entra tutto**. È la casella da cui si recuperano tutti gli
accessi (Google, GitHub, Cloudflare, Bitwarden): girarla per intero
significherebbe copiare i codici di recupero in un secondo posto e darli
in pasto a un modello. Da lì passa **solo ciò che Alessio inoltra a mano**.

**Resta fuori da questa consegna**: il conteggio della spesa AI nel tempo
(oggi si vede solo il totale dei token per messaggio) e la scelta di cosa
fare con gli allegati oltre il primo.
