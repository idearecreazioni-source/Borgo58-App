# Comande — le cinque correzioni dell'ultimo giro

**Mandato**: quattro correzioni di Alessio dopo aver guardato in scala reale
(800 × 1280, calibrazione **74**), più una quinta arrivata mentre lavoravo.
**Nessuna migrazione.**
⚠️ **È l'ultimo giro su questo disegno**, per sua decisione: non ho aperto
fronti nuovi, e quello che non mi torna è scritto in fondo invece di essere
allargato.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **NON HO GUARDATO LE SCHERMATE, e non è una scelta**: per aprire
   Comande serve entrare col PIN, e **non digito PIN**. Quello che ho
   verificato nel browser a 800 × 1280 sono **le misure che si possono
   leggere senza entrare**: la calibrazione arriva a 74 e le due misure nuove
   del testo danno **3,20 mm** e **4,00 mm**. Il resto è aritmetica sulle
   regole scritte nel codice.
2. 🔴 **I quattro stati non li ha guardati nessuno** dopo queste modifiche.
3. 🔴 **Lo scorrimento automatico sul menu non l'ho visto scorrere.** So dove
   *deve* fermarsi (il menu in cima allo schermo, categorie comprese) e come
   è scritto; **non so come si vede**.
4. ⚠️ **La larghezza dei caratteri resta una stima**: quanti ne stiano in un
   pulsante dipende dal font di sistema del tablet.

---

## 1 · Niente pulsanti doppi — e i pannelli a sinistra

**Erano davvero doppi**, misurato: «Invia comanda», «Preconto», «Chiudi
conto» e «Annulla il tavolo» esistevano **due volte** — nella colonna dei
gesti dentro la pianta **e** in un riquadro sotto. Lo stesso per «Apri il
tavolo» e «Annulla», che stavano nella barra dei tavoli sotto la pianta.

**Adesso stanno in un posto solo, dentro la pianta**, che è dove Alessio li
ha visti e approvati. La barra sotto è sparita, e con lei il suo doppione del
gesto «non è arrivato», che è passato nella stessa colonna.

⚠️ **«Di fianco a sinistra» è dove quella colonna sta già**: nel disegno in
piedi lo spazio di cucina e servizi cade **a sinistra**, nella metà bassa —
368 punti di larghezza per mille di altezza. Non ho spostato niente per
ottenerlo: era già lì.

⚠️ **Il totale invece resta sotto**, ed è l'unica cosa rimasta di quel
riquadro: non è un gesto, è un numero, e sta sotto le righe da cui nasce.

⚠️ **I pulsanti sono impilati a tutta larghezza**, non affiancati a due a
due: con le scritte ingrandite «Lascia aperto» non ci starebbe in mezza
colonna. Sette pulsanti fanno **476 punti** su **mille** disponibili.

---

## 2 · Le scritte, misurate in millimetri

🔴 **Il problema era lo stesso dei bersagli di tocco, e per mesi non si è
visto perché si guardava da un monitor**: `text-xs` sono 12 pixel, che su un
computer fanno 3,2 mm — leggibili — e sul tablet della sala fanno **1,62 mm**.

| | prima | adesso |
|---|---|---|
| testo normale (etichette, righe, prezzi) | **1,62 mm** | **3,20 mm** |
| testo grande (nomi dei piatti, totali) | **1,89 mm** | **4,00 mm** |
| nome del tavolo nella pianta | 3,48 mm | **4,25 mm** |
| cifra dei coperti nella pianta | **2,51 mm** | **3,28 mm** |

⚠️ **Non sono numeri scelti a occhio**: sotto i 3 mm un testo non si legge in
piedi, e i due valori sono **misurati nel browser** alla calibrazione vera —
3,20 e 4,00 esatti.

⚠️ **E si misurano in centimetri veri, non in pixel**, come i bersagli di
tocco: `calc(var(--pxcm) * 0.32)`. Su un computer restano **12,1 punti**,
cioè esattamente il `text-xs` di prima — **cresce solo dove serve**.

⚠️ **Le scritte dentro la pianta sono in unità di SALA**, quindi crescono e
rimpiccioliscono col disegno: è ciò che le tiene dentro la sagoma su ogni
schermo.

✅ **La pianta non sborda**: le sette prove pure sono verdi, i 667 punti sui
736 non sono stati toccati.

---

## 3 · «Annulla tavolo» coi pulsanti grossi

Era un link piccolo in fondo alla pagina. Adesso è nella colonna dei gesti,
grande come gli altri.

⚠️ **La condizione non cambia**: si può solo se non è stato inviato niente in
cucina. Dopo, un conto **si chiude, non si annulla** — e quella regola non è
un'etichetta, è il motivo per cui il pulsante esiste.

---

## 4 · Via le didascalie (solo dalle Comande)

**Tolte quattro spiegazioni**:

- «Vale dai conti aperti da adesso in poi: i conti già chiusi conservano il
  prezzo…»;
- «I tavoli si spostano e si rinominano dalla pianta, in Calendario Eventi →
  La sala»;
- «Se hanno accostato più tavoli, toccali tutti… I tavoli scuri hanno già un
  conto aperto; i colorati aspettano qualcuno»;
- «— su questo tavolo c'è un altro turno dopo» (resta l'avviso: **Da liberare
  entro le 21:30**).

🔴 **Restano, e non sono didascalie**:

- **«Non riesco a leggere la sala. Non vuol dire che è vuota: vuol dire che
  non lo so»** — dice che un dato **non è arrivato**;
- **«Nessun menu attivo»**, **«Nessun piatto selezionato»**, **«Nessun tavolo
  configurato»** — dicono che una cosa non c'è;
- il testo dentro **«Annulla tavolo»** e **«non è arrivato»** — dicono cosa
  succede prima che succeda;
- **«È cominciata una giornata nuova. Questa è ancora la sala della serata
  di…»** — dichiara un limite: la sala non cambia da sola.

⚠️ **Fatto solo sulle Comande**, come chiesto.

---

## 5 · Aprendo un tavolo, la schermata scende sul menu

✅ **I due casi passano da due funzioni diverse**, quindi non c'è niente da
separare — l'ho misurato prima di scrivere:

- `apriSelezione` → apre un tavolo **nuovo**: **scende**;
- `apriConoscendoIlConto` → entra in un conto **che esiste già**: **non
  scende**, perché chi tocca un tavolo aperto può volere il riepilogo o i
  pulsanti.

⚠️ **Lo scorrimento è immediato** (`behavior: "auto"`, non `smooth`): in
servizio un movimento che dura mezzo secondo si legge come un ritardo
dell'app.

⚠️ **Si ferma col menu in cima**: il riferimento è sul contenitore del menu,
che comincia con i filtri delle portate — quindi in cima si vedono i filtri e
sotto i primi piatti, non un piatto tagliato a metà. 🔴 **Ma questo è come è
scritto, non come l'ho visto**: è il punto 3 di ciò che non è verificato.

---

## Le prove

**Nessuna prova nuova**: le sette del giro precedente coprono la misura che
conta (la pianta entra in larghezza) e sono verdi. Le 230 prove pure passano.

⚠️ **Quello che nessuna prova copre è tutto il resto di questo giro**: che i
pulsanti non siano doppi, che il testo sia leggibile, che lo scorrimento si
fermi nel punto giusto. In questo progetto **nessuna prova guarda una
schermata**, e queste cinque correzioni sono tutte di schermata.

---

## ⚠️ Tre cose che ho lasciato stare — decide Alessio

1. **`siVedeLaBarraDeiTavoli()` non serve più a nessuno**: decideva se
   mostrare la barra sotto la pianta, che non esiste più. La funzione e le
   sue prove pure sono ancora lì. *È la forma della «colonna spenta» che
   questo progetto di solito toglie* — non l'ho fatto per non allargare il
   giro.
2. **Il menu resta sotto la pianta**, e senza lo scorrimento automatico
   sarebbe a mille punti. Adesso ci si arriva da soli aprendo un tavolo, ma
   **tornandoci dopo** (per aggiungere un piatto a metà servizio) si scorre
   di nuovo a mano.
3. **Le frasi di cui non ero sicuro le ho lasciate**: «Tocca un tavolo per
   aprirlo» (è un invito, non una spiegazione) e la riga della serata
   scaduta. *Meglio una frase di troppo che un avviso in meno.*

---

## Per Alessio, in una riga

I pulsanti del conto sono tutti in un posto solo, dentro la pianta; le
scritte sono passate da 1,6 a 3,2 millimetri veri; «Annulla tavolo» è grande
come gli altri; e aprendo un tavolo la schermata scende da sola sul menu.

---

**Commit**: dichiarato al momento del commit finale di questa consegna.
