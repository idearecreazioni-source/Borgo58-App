# I cinque difetti del collaudo, e le tre migrazioni che ne sono uscite

**21/08/2026, notte** · difetti dal 3° al 6° trovati dalle mani di Alessio
durante il collaudo dal vivo, più il difetto trovato misurando.

**Migrazioni applicate in produzione:** `20260821000001`, `20260821000002`,
`20260821000003`. Tutte e tre passate prima dal progetto di prova.

> ⚠️ **Questo riepilogo era in arretrato**, e a rilevarlo è stata la rete di
> `npm run migra`, che si è rifiutata di applicare la pulizia dei dati di
> collaudo finché le tre non fossero nominate **per intero**. Ha funzionato
> esattamente come doveva: le tre erano state applicate, i difetti raccontati
> in chat, e nessun documento le nominava.

---

## 1 · `20260821000001` — una percentuale si scrive in un modo solo

🔴 **Terzo difetto**, letto a schermo da Alessio: una percentuale usciva
scritta male. La maschera conteneva un `#`, che in `to_char` lascia uno
spazio dove la cifra non c'è.

**Misurato prima di correggere**, come chiesto: cercate **tutte** le maschere
`to_char` numeriche del database — **nove**. Due sbagliavano.

`percento(numeric)` è ora **l'unico posto** dove una percentuale diventa
testo, sullo stampo di `euro()` (17/08). Tre funzioni riscritte **dal corpo
vivo letto dal database**, non dai file che le avevano create (regola del
18/08): `pos_in_transito`, `prezzo_preventivo`, `quota_deducibile`.

⚠️ La verifica **chiama** le funzioni riscritte invece di limitarsi a
crearle: Postgres accetta una funzione che ne chiama una inesistente, e
«creata» non vuol dire «risponde» (lezione del 17/08).

---

## 2 · `20260821000002` — la capienza si riconta

🔴 **Quarto difetto**, il più grosso della serata. Il conto dei posti si
faceva **una volta sola**, dentro `accetta_preventivo`, e non si rifaceva
mai più. Referto completo in
[la capienza si conta una volta sola](../referti/20260821_la_capienza_si_conta_una_volta_sola.md).

Misurato su una sala da 34:

| cosa succedeva | conseguenza |
|---|---|
| l'evento scende a 2 persone | la spunta «sala piena» **restava accesa** — una serata bloccata per niente |
| l'evento si sposta di un giorno | la spunta restava sul giorno **vecchio** e non compariva sul **nuovo**: si prendevano prenotazioni per una sera già piena |
| si corregge il preventivo accettato | **non arrivava affatto alla cena**: il preventivo diceva 34 e la sala ne aspettava 10 |

**Strada 2, decisa da Alessio**: si riconta quando cambia una cena **nata da
un preventivo**. Le prenotazioni normali restano come oggi.

⚠️ **La ragione della scelta è scritta nella migrazione**: la strada 1
(ricontare a ogni prenotazione) non sarebbe una correzione — sarebbe **il
cambio della regola del 14/08 travestito da correzione** (*«il sistema non
decide più se un gruppo entra: lo decide Alessio»*).

🔴 **IL LIMITE, dichiarato e non nascosto**: se a riempire la sala sono le
prenotazioni **normali**, la spunta non si accende. È voluto oggi, ed è la
domanda che Alessio si è tenuto.

⚠️ **La capienza continua a contarsi in un posto solo** (`capienza_della_sala`).
Qui nasce un solo posto dove si decide *cosa fare del risultato*
(`sincronizza_spunta_sala`), che prima era scritto dentro l'accettazione.

**Sei casi di verifica**, A–F, e il sesto è quello che conta: **una
prenotazione normale NON deve accendere la spunta** — senza quel caso avremmo
fatto la strada 1 senza dirlo.

⚠️ **Rotta apposta due volte**: la seconda rottura dava lo stesso errore
della prima, perché non avevo rimesso a posto il trigger in mezzo. Rimesso e
rifatto, ha segnalato correttamente il caso E.

---

## 3 · `20260821000003` — una quantità si scrive in un modo solo

🔴 **Quinto difetto**, letto a schermo in Allineamento magazzino:
*«ne risultavano 54. kg, ne hai 58.. Ce ne sono in più 4..»*

`FM999999990.999` su un intero lascia il punto — «54.» — e col punto della
frase diventa «54..». Misurato: **tutte** le partite in magazzino hanno
quantità intere, quindi si vedeva su ognuna.

`quantita(numeric)` è ora l'unico posto. Fino a **tre** decimali, perché in
magazzino si pesano i grammi, e con la virgola italiana.

🔴 **E la prova che non era un caso**: due migrazioni del **14/08** usano la
stessa maschera togliendo il punto **a mano**. Chi le ha scritte lo sapeva.
Nel mio del 20/08 quella cura non è stata rifatta — e non poteva esserlo,
perché non era una regola: era un rimedio locale ripetuto a memoria.

⚠️ **Perché la mia ricerca l'aveva mancata**: l'analisi è scritta per esteso
in [cosa non mi convince](20260820_cosa_non_mi_convince.md) — *quella maschera
era già nel mio elenco, l'ho letta e non l'ho eseguita perché non
**somigliava** a quella rotta, e mi sono fermato alla prima conferma.*

**Il controllo che vale più degli altri** è una **proprietà**, non un
conteggio: nessuna funzione del database scrive più una quantità con la
maschera che lascia il punto.

---

## 4 · Il sesto difetto — nessuna migrazione, ma la stessa famiglia

Registrando il consenso commerciale su un cliente, **l'email appena scritta e
non ancora salvata spariva**. Nessun errore.

**Misurate tutte e 33 le schermate** che ricaricano dopo un gesto. Ne restano
**due** col difetto vero: la scheda cliente, e **la previsione di cassa** —
che non aveva visto nessuno: aggiungere una scadenza rileggeva i due campi
del POS, che sono gli unici scritti a mano in quella schermata e nascono
vuoti in attesa della banca.

Le altre tre esposte erano già curate — **ma le cure erano scritte dentro le
singole schermate** (12/08 Posta in arrivo, 17/08 Fatture). *Un rimedio
ripetuto a memoria non è una regola*: ora sta in
`src/lib/calcoli/ricarica.js` con 5 prove.

---

## 5 · Il metodo, dove ha funzionato

- **`--fino-a` non bastava.** Il mandato diceva di usarlo per tenere indietro
  la pulizia dei dati di collaudo, ma quel filtro **taglia dall'alto** e la
  pulizia è del giorno prima: ci rientrava. Lanciandolo in **sola lettura**
  prima di applicare, l'elenco l'ha mostrata. Con `--conferma` il gestionale
  vero si sarebbe svuotato.
- **Non è stato aggirato**: `npm run migra` ha imparato `--salta`, provato in
  sola lettura e **committato prima di essere usato**.
  *Quando un comando non sa fare una cosa legittima, la cosa da correggere è
  il comando.*

---

## 6 · Cosa non è verificato

- ⚠️ **La regola delle prenotazioni normali non è stata provata da una mano**:
  i sei casi sono provati dentro la migrazione, ma nessuno ha riempito una
  sala vera con prenotazioni singole.
- ⚠️ **`percento()` e `quantita()` non sono state viste a schermo da Alessio
  dopo la correzione** — solo lette dal database.
- 🔴 **Nessuna prova di questo progetto guarda una schermata**, quindi i tre
  difetti letti a schermo restano una categoria che solo un occhio trova.

---

## 7 · Cosa abbiamo rovesciato

**Niente.** Le tre migrazioni chiudono difetti, non rovesciano decisioni.

⚠️ Il punto più vicino a un rovesciamento è la **strada 2** della capienza, e
la sua caratteristica è precisamente **di non rovesciare niente**: la regola
del 14/08 (*la sala la decide Alessio, non il sistema*) resta intera, e il
limite che ne discende è dichiarato invece che curato di nascosto. La strada
che l'avrebbe rovesciata — ricontare a ogni prenotazione — è stata scartata
per questo, e la domanda è rimasta in mano ad Alessio.
