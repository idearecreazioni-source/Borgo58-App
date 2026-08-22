# Il terzo gruppo — solo la parte che non dipende dalle crocette

**Blocco 2 del mandato del 22/08.** **Nessuna migrazione.**
Toccate **5 schermate**. 🔴 **Nessuna dimensione di testo è stata cambiata**:
è la condizione del mandato, e le ~40 schermate da scrivania restano in
attesa delle crocette di Alessio.

---

## 1 · Le frasi diventate false: ne restava **una**, non due

Il mandato ne dava per vive **due** delle tre del censimento. Andate a
guardare nel codice, **una sola lo era**:

| # | dove | stato vero |
|---|---|---|
| 1 | `/prenota` «Cerco i posti liberi…» | ✅ già corretta stamattina (`8b6781b`) |
| 2 | `/cassa` «Prima nota **manuale**…» | 🔴 **viva — corretta adesso** |
| 3 | `/comande` la causa morta | ✅ già corretta |

### La seconda, e perché era il caso peggiore da rileggere

> **«Prima nota manuale — la riconciliazione POS automatica arriverà con la
> scelta del sistema di cassa (§3.2).»**

⚠️ **Era falsa a METÀ**, e questa è la cosa da tenere: la seconda parte è
ancora vera (i due parametri del POS sono vuoti, in attesa della banca), ed
è proprio la parte vera che faceva sembrare giusta anche l'altra. Falsa era
la parola **«manuale»**: dal 15/08 (`20260815000004`) gli incassi in
contante dei conti chiusi entrano nel saldo **da soli** — letti, non
copiati. La schermata lo mostra già poco sotto, con «+ … di sala (N conti)».

**Adesso**: *«Gli incassi in contante dei conti chiusi entrano da soli; il
resto si registra a mano. La riconciliazione del POS arriverà con la scelta
del sistema di cassa.»* Tolto anche il «(§3.2)», che rimanda a un documento
che chi guarda quella schermata non ha davanti.

---

## 2 · 🔴 Due conferme di cancellazione **rifatte a mano**

`<ConfermaDistruttiva>` è il componente che disegna «Sì, elimina / Annulla»
su tutto il gestionale, ed è stato portato stamattina a **8,50 mm** di
bersaglio e **5 mm veri** fra i due pulsanti. **Due schermate non lo
usavano**: ne avevano una copia con `gap-2`, cioè **1,08 mm**.

| dove | cosa porta via | prima | dopo |
|---|---|---|---|
| `/documenti/:id` | il documento **e il suo file** | 1,08 mm | **5,00 mm** |
| `/personale/:id` | **documenti, ferie e buste paga** | 1,08 mm | **5,00 mm** |

⚠️ **E c'era da vederlo dentro il commento del componente stesso**, che
dichiara: *«la forma è quella che "Elimina dipendente" usa dal 09/08»*. La
forma era stata **estratta** da lì — e i due originali non erano mai stati
convertiti. *Un pezzo di codice che dà il nome a un componente e poi non lo
usa non somiglia a un difetto: somiglia all'originale.*

⚠️ Il dipendente è il caso più stridente: quella schermata **usa già** il
componente per i documenti e per le ferie, e teneva la copia a mano proprio
sul gesto più grosso.

✅ **Guardate tutte e due dal vivo** sul progetto di prova, su un documento
e un dipendente veri: aperta la conferma, misurati **8,50 mm** i pulsanti e
**5,00 mm** la distanza, letta la domanda giusta, poi premuto «Annulla» —
niente è stato cancellato.

---

## 3 · Tre coppie pericolose, e la peggiore era a **0,54 mm**

| schermata | i due gesti | prima | dopo |
|---|---|---|---|
| `/fiscale/strumenti` | «Segna in uso» / **«Rimuovi»** | **0,54 mm** | 5,00 |
| `/ricettario/ricette/:id` | «↓» / **«Rimuovi»** (fasi) | **0,54 mm** | 5,00 |
| `/agricolo` | «Raccolto» / **«Rimuovi»** (colture) | 1,62 mm | 5,00 |

⚠️ **Quella delle fasi è la peggiore della famiglia**, e non per il numero:
«↓» si preme **più volte di fila** per spostare una fase di tre posti — cioè
il gesto giusto porta il dito ripetutamente addosso a quello che cancella.

⚠️ Le due frecce **fra loro** restano vicine, ed è voluto: sono lo stesso
gesto in due versi, e premere «↑» invece di «↓» si disfa premendo l'altra.

---

## 4 · 🔴 La cosa che ha trovato la MISURA e che nessuna rilettura dava

Allargato il gap **dentro** la riga delle fasi, sono andato a rimisurare. Il
«Rimuovi» più vicino alla freccia **non era più il suo**:

> la «↓» della fase **2** stava a **4,59 mm** dal «Rimuovi» della fase **1**.

Perché `space-y-2` fra due schede vale **1,08 mm veri**, cioè meno del gap
che avevo appena sistemato dentro la scheda.

🔴 **E il danno di quel tocco è peggiore di quello che sembrava**: chi manca
la freccia mentre sposta la fase 2 **non cancella la fase 2 — ne cancella
un'altra**. Guarda l'elenco, vede un numero di righe diverso da quello che
si aspetta, e non ha nessun modo di capire cosa è appena successo.

⚠️ **La regola che ne esce**: *allontanare due pulsanti dentro una riga non
basta — il vicino di un pulsante può stare nella riga accanto.* Dopo la
correzione dello spazio fra le schede, tutte e sei le coppie (↑ e ↓ per tre
fasi) stanno a **5,00 mm**, e il «Rimuovi» più prossimo a ogni freccia è
tornato a essere **quello della sua stessa fase**.

⚠️ **Per vederlo ho dovuto costruire il caso**: la ricetta di prova non
aveva fasi, quindi tre fasi marcate `MISURA-collaudo`, misurate, e **tolte
subito dopo** (verificato: zero rimaste).

---

## 5 · Cinque falsi allarmi, riconosciuti guardando cosa fanno

Il setaccio ne ha segnalate 28. Aperte una per una, **cinque non erano
coppie pericolose** e sono rimaste esattamente come stavano:

- **`/agenda/nuovo` — «Rimuovi promemoria»**: svuota due campi del modulo.
  Si rifà riscrivendo la data.
- **`/ricettario/ingredienti/:id` — «Annulla»**: chiude il riquadro «nuovo
  fornitore». Non cancella niente.
- **`/magazzino/fornitori/:id` — «Disattiva fornitore»**: sta in un
  `justify-between`, cioè all'estremo opposto del suo vicino.
- **`/editor-menu/giorno` — «Elimina questo giorno» / «Rimuovi»**: stanno in
  due blocchi diversi del disegno, uno nell'intestazione e uno nelle righe.
- **`/ricettario/ricette/:id` — «Rimuovi» di un ingrediente**: è in una cella
  di tabella, gli altri comandi sono in altre celle.

⚠️ **Il conto delle tre giornate sale a 15 coppie segnalate e 9 falsi
allarmi.** *Il setaccio legge l'etichetta; solo aprire il codice dice cosa
fa il pulsante.*

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Le liste di tre schermate su cinque erano vuote**: `/fiscale/strumenti`
   (0 strumenti) e `/agricolo` (0 colture) non mostravano nessun «Rimuovi».
   Lì la correzione è **letta nel codice e non vista disegnata** — è lo
   stesso limite dichiarato ieri, e le fasi di ricetta sono l'unico caso in
   cui ho costruito il dato per guardare.
2. ⚠️ **Le ~40 schermate da scrivania non sono state misurate nel testo**, per
   mandato. Quando arriveranno le crocette, quelle che vanno sul tablet vanno
   rifatte.
3. ⚠️ **Il setaccio delle coppie guarda `src/pages`**: un gesto pericoloso
   dentro un componente condiviso non comparirebbe. `ConfermaDistruttiva` è
   a posto per averla guardata, non perché il setaccio la copra.
4. 🔴 **Nessuna fotografia**: il pannello del browser di questa sessione non
   compone frame. Le distanze sono misure geometriche prese nella pagina
   viva.

---

## Cosa abbiamo rovesciato

**Niente.** Due copie rientrano nel componente da cui erano nate, tre
distanze crescono, una frase smette di dire il falso.

⚠️ **E in particolare non è stato rovesciato il criterio delle conferme**:
`<ConfermaDistruttiva>` continua a **non** stare su tutto — le fasi, le voci
di menu e le colture restano senza, perché *una conferma su ogni gesto
insegna a premere «sì» senza leggere*. Su quelle si è agito **solo sulla
distanza**, che è un'altra cosa: non chiede un pensiero in più, toglie un
errore di dito.

---

## 6 · I dati di collaudo, tolti

- **3 fasi** `MISURA-collaudo` create per misurare: rimosse, **0 rimaste**.
- **2 conti** aperti dal collaudo del foglio cucina (T3 con 6 righe, T4
  vuoto): **annullati, non chiusi** — chiudere avrebbe scritto un incasso, e
  «zero movimenti di cassa» è la proprietà su cui poggia il collaudo.
  Controllato dopo: **0 conti aperti**, movimenti di cassa **invariati a 2**.
