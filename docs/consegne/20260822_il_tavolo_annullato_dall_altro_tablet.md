# Il tavolo annullato dall'altro tablet

**Blocco 1 del mandato delle tre cose decise.**
**Migrazione `20260822000003`** — ⚠️ **solo sul progetto di prova**.

---

## 1 · 🔴 La misura ha corretto il mio referto di ieri

Ieri avevo scritto due cose. Rimisurandole prima di correggere, **una era
imprecisa**:

| quello che avevo scritto | quello che è vero |
|---|---|
| «segno un piatto e la riga **viene scritta** su un conto annullato» | ✅ **vero**, riprodotto |
| «premo Invia, **non succede niente**, nessun errore a schermo» | 🔴 **non esatto**: l'invio **è già rifiutato** dal trigger del 16/08, con un messaggio suo |

⚠️ **Perché non l'avevo visto**: cercavo a schermo le parole «annullato /
errore / violato», e quel messaggio dice **«già chiuso»**. *Una ricerca che
non trova non è una prova che non ci sia* — ed è la stessa forma del difetto
che questo blocco chiude, vista dal lato di chi misura.

Restavano quindi **due cose vere** da fare, e sono queste.

---

## 2 · Il vincolo che mancava: `insert`

`trg_riga_servita` (16/08) copre **update e delete**. Non **insert**. Ecco
perché la riga entrava.

**Adesso** `trg_riga_su_conto_non_aperto`, prima di ogni inserimento: se il
conto non è `aperto`, la riga non entra.

⚠️ **Nel database e non nella schermata**, com'è la regola di casa: chiude
la strada per **tutte** le porte, comprese quelle che nessuno ha ancora
scritto. Una guardia nella schermata avrebbe protetto solo il pulsante che
conoscevo.

---

## 3 · 🔴 Due messaggi, non uno — ed è il punto del blocco

Il mandato: *«chi serve deve capire PERCHÉ, non solo che non funziona»*.

| stato del conto | cosa legge chi serve |
|---|---|
| **annullato** | «Il tavolo T4 è stato annullato da un'altra postazione: quello che segni adesso andrebbe perso. **Riapri il tavolo e riprendi la comanda.**» |
| **chiuso** | «Il conto del tavolo T4 è già chiuso: non si aggiungono piatti a un conto su cui hai già incassato. **Apri un conto nuovo.**» |

⚠️ **Sono due fatti diversi che portano a due gesti diversi**: da un conto
annullato si ricomincia, da uno chiuso si apre un tavolo nuovo. Un messaggio
solo direbbe «non si può» e lascerebbe chi serve lì a premere di nuovo.

**E anche il rifiuto dell'invio impara la parola giusta**: diceva «già
chiuso» anche sugli annullati. ⚠️ **Toccato solo il messaggio, non la
regola**: quel trigger difendeva bene, sbagliava a dire cosa stava
succedendo.

---

## 4 · ✅ Provato con le mani, nel modo in cui capita

Due postazioni, come in sala:

1. dal **browser** apro T4 e ci sto sopra;
2. da **fuori** l'altra postazione lo annulla (gesto vero, `cancelOrder`);
3. dal browser, ignaro, **segno un piatto**.

**Quello che il cameriere vede:**

> Il tavolo T4 è stato annullato da un'altra postazione: quello che segni
> adesso andrebbe perso. Riapri il tavolo e riprendi la comanda.

E la comanda resta **vuota**: il piatto non è entrato nel database.

---

## ⚠️ Cosa NON è verificato

1. ⚠️ **La schermata non si aggiorna da sola** quando il conto viene
   annullato altrove: continua a mostrare «T4 aperto» finché non si tocca
   qualcosa. Adesso il primo tocco **dice cosa è successo** invece di
   scrivere nel vuoto — ma la riga in cima resta quella di prima. Chiuderlo
   vorrebbe dire far ricontrollare lo stato del conto a intervalli, e non è
   in questo mandato.
2. ⚠️ **Il caso «chiuso» non l'ha provato una mano**: è provato dentro la
   migrazione, con la sua controprova.
3. 🔴 **In produzione non è entrato niente.**

---

## Cosa abbiamo rovesciato

**Niente.** Il trigger del 16/08 resta com'era nella sostanza: cambia una
parola, e si copre un'operazione che non copriva.

⚠️ **E in particolare non è stato rovesciato «la sala non si blocca mai»**:
qui non si blocca niente che stesse funzionando — si rifiuta una scrittura
**che sarebbe andata persa comunque**, dicendolo. Il gesto che prima
falliva in silenzio adesso fallisce parlando.

---

## 5 · Una cosa vista dalla verifica, che vale come conferma

La pulizia della verifica **si è fermata da sé**: provando a cancellare le
righe di un conto annullato, il trigger le ha difese. Aveva ragione — e la
strada giusta è quella che il trigger stesso prevede: *se il conto sta
sparendo, le sue righe se ne vanno con lui*.

⚠️ **È anche la prova che la protezione morde davvero**: se avessi potuto
togliere quelle righe a mano, vorrebbe dire che il vincolo non tiene.
