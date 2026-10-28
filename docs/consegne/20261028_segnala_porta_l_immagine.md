# «Segnala» porta l'immagine della pagina

28/10/2026 — chiesto da Alessio dopo la sua **prima segnalazione** (la
conferma «Elimina» storta al telefono): *«non possiamo fare in modo che una
segnalazione alleghi in automatico lo screenshot dell'intera pagina da cui
parte?»*. Il testo salvato diceva quali parole c'erano, non che erano storte.

## Cosa cambia per Alessio

- Premendo «Segnala», il gestionale **fa da solo l'immagine della pagina
  intera** (anche la parte da scorrere, fino a 8000 punti di altezza) nello
  stesso tocco che apre il riquadro. Il riquadro ne resta fuori.
- Nel riquadro si vede la miniatura, con **«Togli immagine»**.
- Mentre l'immagine si prepara, il pulsante dice «Preparo l'immagine…» e non
  invia: misurato 1,3 secondi per l'Agenda a 390 punti.
- Se l'immagine non riesce, il riquadro **lo dice** e la segnalazione parte
  lo stesso senza. Se il deposito la respinge, «Segnalata» lo dice.
- In «Le tue segnalazioni» c'è **«Immagine della pagina»**.
- La frase onesta: non più «Salvo anche questa schermata» (Alessio aveva
  capito, giustamente, che si salvasse un'immagine che non c'era), ma
  «Salvo anche dove sei e il testo di questa schermata».
- Il titolo salvato non porta più il contatore attaccato («Agenda17»).
- Il testo salvato comprende **cosa c'è scritto nei campi** (mai le
  password): nella prima segnalazione il campo TITOLO risultava vuoto.

## Come è fatto

- **Non è una foto dello schermo**: un sito non può farla da solo (l'iPhone
  non lo permette). È un **ridisegno** della pagina fatto dal browser con le
  misure che sta mostrando (`modern-screenshot` 4.7.0, MIT, senza
  dipendenze). Per un difetto di impaginazione è quello che serve.
- La libreria **si carica solo al tocco di «Segnala»** (`import()`): un file
  a parte di 25 kB. Il gestionale passa da 441,24 a **442,88 kB** compressi
  (tetto 450), per il codice del riquadro e della pagina.
- L'immagine va nel deposito `documents`, cartella `segnalazioni/`, già solo
  del titolare. **Prima il file, poi la riga**; il nome dipende da una
  chiave fatta una volta per riquadro, quindi un nuovo tentativo non carica
  una seconda copia. Togliendo una segnalazione, prima la riga e poi il
  file; `npm run deposito:orfani` conosce la colonna nuova.
- Migrazione `20261028000004_la_segnalazione_porta_la_sua_immagine`: la
  colonna `immagine_path`, con il vincolo che la tiene nella sua cartella
  (frase in italiano). Si scrive nascendo, **non si riscrive dopo**: il
  permesso di modifica resta su stato ed esito.
- `public/_headers`: i caratteri di Google anche in `connect-src`, perché
  il ridisegno li rilegge per disegnarli dentro l'immagine.

## Misurato

- **Su Prova**: migrazione applicata, verifica interna passata e annullata
  (zero residui). Prove contro Prova `tests/app/segnalazioni.test.js`:
  **7 su 7**, comprese le tre nuove (il titolare carica e la riga la
  nomina; lo staff non scarica l'immagine; l'immagine non si riscrive e
  fuori dalla sua cartella non entra).
- **Nel browser** (schermata finta dell'Agenda a 390 punti): immagine
  780 × 2660, 102 KB, 1,3 secondi; guardata: stessi caratteri, stesse
  posizioni e stessi a capo della pagina.
- Prove di schermata 471 su 471 (7 nuove in
  `tests/schermate/segnala-con-immagine.test.jsx`); prove pure con le solite
  3 che falliscono solo su Windows per gli a capo.

## Revisioni ECC

- `ecc:security-reviewer`: accessi corretti (deposito, tabella, permessi di
  colonna, vincolo sul percorso). Applicato quello che ha chiesto prima del
  rilascio: i campi riservati (PIN, IBAN, chiavi, codice fiscale, password,
  `data-riservato`) non finiscono nel testo, ciò che è `data-riservato` resta
  fuori dall'immagine, il link all'immagine dura 5 minuti invece di un'ora.
- `ecc:code-reviewer`: nessun errore bloccante. Applicati: il titolo toglie
  solo i contatori marcati `data-contatore` (un «Bilancio 2026» tiene il suo
  numero); il nome di un campo è la prima riga dell'etichetta, al massimo 80
  caratteri; chiudendo il gestionale mentre l'immagine si fa, l'immagine
  arrivata dopo si scarta; un file che il deposito non toglie senza dare
  errore vale come «rimasto».

## Resta

- L'immagine mostra tutto ciò che c'è a schermo (anche cassa e buste paga):
  la vede solo il titolare, e resta finché la segnalazione non si toglie.
  Una regola che le toglie da sola dopo N giorni dalla chiusura si può
  aggiungere se Alessio la vuole.

- **Non provato su un iPhone vero**: lo si guarda su Prova.
- **Il gestionale vero non è toccato**: la migrazione va in produzione solo
  dopo l'ok di Alessio, dal master.
- «Stasera la leggo» resta una promessa senza un controllo automatico che
  la mantenga: oggi le segnalazioni si leggono quando Alessio lo chiede.

## Cosa abbiamo rovesciato

- La scelta del 25/10 «*cosa si vedeva* è testo, non una foto» (migrazione
  `20261025000002`): allora la foto restava fuori per non lasciare file da
  ripulire. La prima segnalazione vera ha mostrato che per un difetto di
  aspetto il testo non basta. Il testo resta; l'immagine si aggiunge, con le
  regole del deposito.
- La CSP del 26/10 non permetteva connessioni ai caratteri di Google: adesso
  sì, solo per i due indirizzi dei caratteri.
