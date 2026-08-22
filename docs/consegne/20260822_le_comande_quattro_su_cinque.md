# Comande — quattro correzioni su cinque, e una fermata dalla misura

**Mandato**: cinque correzioni dal collaudo in scala reale (800 × 1280,
calibrazione 74). **Nessuna migrazione.**
**Fatte: 1, 3, 4, 5.** 🔴 **La n. 2 è ferma, e il mandato stesso diceva di
fermarsi se la misura non reggeva** — §2 qui sotto.

---

## 🔴 2 · IL PALLINO UNICO: mi fermo, il colore NON basta

Il rovesciamento chiedeva un pallino solo — sempre pieno — perché *«a
distinguere i due casi basta il colore del tavolo»*. Il mandato chiedeva di
verificarlo prima. **Verificato, chiamando la funzione che decide i colori
(`segnoDelTavolo`), non leggendola:**

| caso | colore del tavolo | pallino di oggi |
|---|---|---|
| conto aperto, **niente ordinato**, senza prenotazione | **nessuno** (bianco) | vuoto |
| piatti segnati e **mai inviati**, senza prenotazione | **nessuno** (bianco) | pieno |
| conto aperto, **niente ordinato**, con prenotazione | `primo_giro` | vuoto |
| piatti segnati e **mai inviati**, con prenotazione | `primo_giro` | pieno |
| comanda già inviata | `inviata` (scuro) | nessuno |

🔴 **Il colore è IDENTICO nei due casi**, in tutte e due le varianti — e non
è un caso: il colore cambia **solo quando qualcosa è partito** per la cucina
(`comandaInviata`). Prima dell'invio dice da che fascia arriva la
prenotazione, non cosa sta succedendo dentro il conto.

**Quindi il pallino unico non semplificherebbe: cancellerebbe**
l'informazione *«ci sono piatti segnati che nessuno ha mandato in cucina»* —
che è esattamente il rimedio per cui i due pallini erano nati ieri notte.

⚠️ **Se Alessio lo vuole lo stesso, la strada che non perde niente è
un'altra**: dare al caso «segnato e non inviato» **un colore suo** sul
tavolo, e allora il pallino unico diventa vero. È una decisione sua, non
l'ho presa io e non ho scritto niente nel registro dei rovesciamenti: **un
rovesciamento si registra quando è avvenuto**, e questo non è avvenuto.

---

## 1 · «Apri il tavolo» in alto — e i due pannelli non partivano dallo stesso punto

**Misurato prima**: la colonna dei gesti è alta **980 punti**, e nel pannello
del tavolo libero «Apri il tavolo» cominciava a **442** — in mezzo. Causa:
quel pannello aveva `justify-center` e l'altro no.

| pannello | primo gesto | prima | dopo |
|---|---|---|---|
| tavolo libero | «Apri il tavolo» | **442** | **42** |
| tavolo aperto | «Invia» | 42 | **42** |

⚠️ **La cosa che il mandato chiedeva di guardare c'era davvero**: due stati
della stessa colonna con due ancoraggi diversi. *In servizio il dito impara
una posizione* — e trovarne un'altra a seconda dello stato costa un secondo
ogni volta e un tocco sbagliato ogni tanto. Adesso i due stati cominciano
allo stesso punto, e l'ordine dei gesti del tavolo aperto è invariato
(Invia · Preconto · Chiudi conto · Avanti prossimo turno · Annulla tavolo ·
Cambia tavoli · Lascia aperto).

---

## 3 · I turni si separano come li separerebbe la carta

Erano un titoletto grigio in mezzo alle righe. Adesso sono **una banda
piena**, e la ragione data da Alessio ne ha deciso la forma: *quella
divisione è la stessa che finisce sul biglietto stampato*.

| | prima | dopo |
|---|---|---|
| testo | 3,20 mm, grigio, peso 600 | **4,00 mm, chiaro su fondo scuro, peso 700** |
| altezza della riga | — | **6,08 mm** |
| larghezza | quanto il testo | **697 punti**, tutta la lista |

### E il foglio della Cucina — guardato, come chiesto

Lì il turno era **della stessa taglia del nome del tavolo**: si leggeva solo
cercandola, ed è **il posto dove conta di più** (a schermo chi ha segnato i
piatti sa già che turno guarda; sulla carta no).

⚠️ **E qui le misure sono DUE, perché il foglio è disegnato per la carta**:
`--pxcm` non vuol dire niente su una termica. Misurato in tutti e due i modi:

| riga del foglio | sullo schermo della cucina | sulla carta da 72 mm |
|---|---|---|
| il turno, **prima** | 2,16 mm | 4,23 mm |
| il turno, **adesso** | **3,24 mm** | **6,35 mm** |
| nome del tavolo | 2,16 mm | 4,23 mm |

**Adesso il turno è la riga più grande del foglio**, che è come deve essere.
⚠️ **Niente banda nera piena come a schermo**: una termica la stampa male e
consuma nastro — sulla carta lo stesso lavoro lo fanno due righe sopra e
sotto.

---

## 4 · «Invia» in due posti — ed è un pezzo solo

Aggiunto **sotto il totale**, in fondo alla comanda.

⚠️ **Non contraddice la pulizia dei pulsanti doppi di due giorni fa**, ed è
la distinzione che il mandato fa bene a nominare: là erano quattro gesti
ripetuti in fondo alla pagina, qui è **lo stesso gesto dove finiscono i due
percorsi** — chi guarda la sala lo trova nella colonna, chi finisce di
segnare i piatti è già in fondo alla lista, col dito lì.

🔴 **E per questo è UNA funzione sola** (`bottoneInvia`), non due pulsanti
gemelli: due copie divergono al primo ritocco. Misurato che si comportano
davvero allo stesso modo:

| | nella colonna | sotto il totale |
|---|---|---|
| altezza | 8,50 mm | 8,50 mm |
| testo | 3,20 mm | 4,00 mm (è il gesto che chiude una lista lunga) |
| larghezza | 349 punti | 721 punti |
| **spento quando non c'è niente da inviare** | **sì** | **sì**, insieme |
| parola e conteggio | `Invia (N)` | `Invia (N)`, lo stesso |

🔴 **E qui ho fatto un errore che si è visto solo guardando**: per un
passaggio ce n'erano **tre** di pulsanti «Invia» — due nella colonna, perché
la sostituzione automatica aveva colpito il pezzo nuovo invece di quello
vecchio. La compilazione passava e il lint pure; l'ha trovato la misura
delle posizioni sullo schermo.

---

## 5 · La finestra di chiusura conto — la peggiore, misurata prima e dopo

È dove si incassa, ed era scritta con le taglie fisse di Tailwind, che **non
sanno niente della calibrazione**: a 74 valgono 1,5–2,4 mm, cioè **la metà
esatta** della comanda che sta dietro (3,20 mm). Alessio aveva visto giusto.

**I testi** (a calibrazione 74):

| | prima | dopo |
|---|---|---|
| l'elenco dei piatti | **1,62 mm** | **3,20 mm** |
| l'avvertenza «nessun incasso viene registrato» | **1,49 mm** | **3,20 mm** |
| le voci dei pulsanti | **1,89 mm** | **3,20 mm** |
| il titolo | **2,16 mm** | **4,00 mm** |

**I bersagli** (altezza del pulsante):

| pulsante | prima | dopo |
|---|---|---|
| «×» per chiudere | **2,43 mm** | **8,50 mm** |
| «Annulla tavolo» | **3,24 mm** | **8,50 mm** |
| «Paga contante» · «Paga carta» | **4,86 mm** | **8,50 mm** |
| i quattro in basso (due modi · alla romana · sconto · omaggio) | 10,54 mm | **16,28 mm** |

⚠️ **I quattro in basso erano già alti**: quello che li rendeva minuscoli era
**la scritta dentro**, 1,89 mm. Adesso 3,20.

### ⚠️ E NON è l'unica finestra rimasta indietro — l'elenco, non corretto

Censite tutte le schermate delle Comande e i componenti condivisi. **Chi usa
le classi in centimetri veri**: solo `Sala.jsx` e — da adesso — la finestra
di chiusura conto. **Tutto il resto usa taglie fisse**, e la più piccola vale
**1,35 mm** alla calibrazione 74:

| file | testo più piccolo | pulsanti senza classe di tocco |
|---|---|---|
| `PrecontoModal.jsx` — *il foglio che si dà al cliente* | 1,35 mm | 1 su 3 |
| `ConfermaDistruttiva.jsx` — *le conferme di annullamento* | 1,35 mm | 1 su 3 |
| `CalibrazioneTocco.jsx` | 1,35 mm | 2 su 4 |
| `Bar.jsx` | 1,35 mm | 0 su 3 |
| `Cucina.jsx` | 1,35 mm | 0 su 3 (⚠️ ma è **carta**: lì le taglie fisse sono giuste) |
| `Scontrini.jsx` | 1,35 mm | 0 su 2 |
| `AvvisoLettureTagliate.jsx`, `DatoNonLetto.jsx`, `FormNotaCredito.jsx`, `CampoGiornata.jsx` | 1,35 mm | — |

⚠️ **Non le ho toccate**, come da mandato. Due meritano di essere nominate
per prime: **il preconto**, perché è il foglio che finisce in mano al
cliente, e **le conferme di annullamento**, perché sono il punto in cui si
butta via qualcosa e la fretta è massima.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non l'ha visto un occhio**: nessuna fotografia, solo misure prese
   interrogando la pagina. Se la banda del turno sia *bella* o se il verde
   di «Invia» si distingua in sala restano giudizi di Alessio.
2. ⚠️ **Il biglietto non è uscito da una stampante**: i 6,35 mm sulla carta
   sono il conto di come il browser traduce i pixel in millimetri di stampa
   (96 punti per pollice), non un foglio misurato col righello.
3. ⚠️ **Nessuna prova automatica guarda queste cose**: in questo progetto le
   prove non hanno una pagina. Quello che tiene ferme le misure è la
   calibrazione (`--pxcm`) e il fatto che le classi siano in centimetri
   veri; non c'è niente che diventi rosso se qualcuno rimette un `text-sm`.
4. ⚠️ **Il pallino resta come ieri** (due gradi): non ho toccato niente,
   vedi §2.

---

## Cosa abbiamo rovesciato

**Uno, e non è quello che ci si aspettava.**

- **cosa era stato deciso, e quando**: il 21/08, «una cosa, un posto solo» —
  via i pulsanti doppi delle Comande, su richiesta di Alessio;
- **la ragione di allora**: due pulsanti che fanno la stessa cosa a mezzo
  metro di distanza sono due cose da imparare, non una comodità;
- **cosa si decide adesso**: «Invia» esiste **in due posti**;
- **perché la ragione di allora non vale più — ⚠️ e in buona parte vale
  ancora**: resta vero per gesti ripetuti a caso, e infatti Preconto, Chiudi
  conto e Annulla tavolo **non tornano** in fondo alla pagina. Cade solo per
  questo gesto, perché non è «lo stesso pulsante due volte»: è **il punto in
  cui finiscono due percorsi diversi**. E il prezzo — due cose da tenere
  d'accordo — è stato tolto rendendole **una sola**.

⚠️ **Il rovesciamento del pallino NON è registrato**, perché non è avvenuto:
la misura l'ha fermato (§2). *Un elenco dei rovesciamenti che contiene anche
quelli non fatti smette di rispondere alla domanda per cui esiste.*

---

## 6 · Cosa ho guardato

Con l'accesso di collaudo sul progetto di prova, a **800 × 1280**,
`b58_pxcm` = **74**:

1. **Tavolo libero** — toccato T3: il pannello compare dentro la pianta e
   «Apri il tavolo» sta a **42 punti** dalla cima (era 442).
2. **Tavolo aperto con tre turni** — aperto T4, segnati tre piatti su tre
   turni con «Prossimo turno», inviati tutti insieme: la comanda mostra
   **tre bande** «1° TURNO», «2° TURNO», «3° TURNO» larghe 697 punti, testo
   4,00 mm. Totale **37,00 €**. I due «Invia» spenti insieme dopo l'invio.
3. **Il foglio della Cucina** — tre fogli, uno per turno, col turno a 3,24
   mm sullo schermo e 6,35 sulla carta.
4. **La finestra di chiusura conto** — aperta su quel conto e misurata riga
   per riga, prima e dopo (le tabelle del §5).

**Ripulito**: i due conti di prova (T3 annullato dalla schermata, T4 tolto
dal database) — **0 conti aperti, 0 righe orfane** ricontrollati dopo.

**Suite**: 258 prove pure, 301 sui dati veri. Tutte verdi.
