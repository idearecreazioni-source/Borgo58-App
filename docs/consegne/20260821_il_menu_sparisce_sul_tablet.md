# Il menu sparisce sul tablet

**21/08/2026** · un passo solo. **Nessuna migrazione**, nessun dato toccato:
tre classi in `src/components/Layout.jsx`.

---

## 1 · Il difetto, misurato

Il menu laterale dei moduli compariva da **768 punti** in su (`md:`), e il
mini tablet di Alessio in verticale — **lo strumento vero del servizio** — è
largo **768 punti esatti**. Ci cadeva dentro per un punto.

Conseguenza in Comande: il menu si prendeva **256 punti** e alla sala ne
restavano **~575 su 768**. *Un quarto dello schermo se ne andava nel menu
proprio nella schermata che ne ha più bisogno.*

---

## 2 · Il numero scelto, e perché quello

**1024 punti** (`lg:`). Non me l'ha dato il mandato: l'ho scelto misurando.

| | |
|---|---|
| tablet in verticale (il caso da lasciare fuori) | **768** |
| portatile più stretto in commercio (il caso da tenere dentro) | **1280** |
| **soglia scelta** | **1024** |

⚠️ **È l'unico numero che non passa vicino a nessuno dei due**: sta **256
punti sopra** il tablet e **256 punti sotto** il portatile. Esattamente in
mezzo.

**Perché non 1280**: lo rasenterebbe dall'altra parte — un portatile da 1280
esatti resterebbe col menu per un punto, cioè *lo stesso errore allo
specchio* di quello che stiamo correggendo.

⚠️ **Verificato nel CSS prodotto, non assunto**: questo progetto configura
Tailwind in CSS e i punti di rottura potevano essere stati ridefiniti. Non lo
sono — `lg:` sta dentro `@media (width>=64rem)`, cioè **1024**.

---

## 3 · Cosa cambia altrove

**La soglia è del gestionale intero**, quindi la domanda è d'obbligo. Misurato:

| fascia di larghezza | prima | dopo |
|---|---|---|
| sotto 768 (telefono) | menu nascosto, pulsante | **identico** |
| **768 – 1023** (tablet verticale) | menu fisso + 512 punti di contenuto | **nessun menu, 768 punti** |
| 1024 e oltre (computer) | menu fisso + il resto | **identico** |

🔴 **Cambia una sola fascia, ed è quella voluta.** Sopra 1024 e sotto 768 non
si muove niente.

**Chi usa `lg:` nel progetto sono due file, e nessuno dei due si rompe:**

- `comande/Bar.jsx` — `lg:grid-cols-2`. A 1024 il menu adesso c'è, quindi lo
  spazio è **lo stesso di prima** (768) e le due colonne sono identiche. Fra
  768 e 1023 aveva una colonna in 512 punti, ora una colonna in 768.
- `components/Logo.jsx` — `lg` lì è **la taglia di un logo**, non una
  larghezza di schermo. Non c'entra.

Le **20 schermate che usano `md:`** non cambiano disposizione (`md:` resta a
768): cambia solo lo **spazio** in cui si dispongono, che fra 768 e 1023 passa
da 512 a 768. Tutte migliorano, nessuna peggiora.

---

## 4 · Il rischio che il mandato nominava, e come è chiuso

> *«se il menu si nasconde e non si riapre, il gestionale è inutilizzabile
> sul tablet»*

⚠️ **Le tre classi sono una cosa sola e sono state cambiate insieme**: la
barra fissa (`lg:block`), il pannello che scorre da lato (`lg:hidden`), e la
riga in alto col pulsante che lo apre (`lg:hidden`). Cambiarne una sola
avrebbe prodotto proprio quel guasto — menu via, e nessun modo di riaprirlo.

✅ Verificato nel CSS prodotto che **tutte e tre** le classi esistono e stanno
nello **stesso** media query. Il commento sopra il codice lo dice, perché chi
ne toccherà una fra sei mesi sappia che vanno insieme.

---

## 5 · Una cosa che NON ho fatto, e va detta

⚠️ **A 768 punti la sala non ne avrà 768 esatti, ma ~704.** Il contenuto ha
un margine interno (`md:px-8`, 32 punti per lato) che si attiva anch'esso a
768 e che **non ho toccato**.

**Non è una dimenticanza: è fuori dal perimetro.** Il mandato diceva una cosa
sola — che il menu non occupi spazio — e quel margine è una decisione a sé,
che riguarda tutte le schermate del gestionale e non le sole Comande.
**Si decide dopo che Alessio ha guardato lo spazio vero**, insieme alle altre
(la colonna di lato, il tavolo toccato, lo scorrimento).

---

## 6 · Cosa non è verificato

- 🔴 **Nessuna mano ha ancora aperto le Comande sul tablet.** È l'unica prova
  che conta, e nessuna prova automatica di questo progetto guarda una
  schermata — men che meno la sua larghezza.
- ⚠️ **Non ho potuto provarlo io nel browser**: il server di sviluppo non era
  in funzione, e per entrare servirebbe il PIN, che non inserisco mai.
  Quello che è verificato è il CSS prodotto: le tre classi esistono e stanno
  a 1024.
- ⚠️ **Il caso «tablet in orizzontale» non è stato provato**: a 1024 punti il
  menu ricompare. Se Alessio girasse il tablet, si ritroverebbe il menu — che
  a quella larghezza però ci sta.

---

## 7 · Cosa abbiamo rovesciato

**Niente.** La soglia `md:` non era una decisione dichiarata da nessuna
parte: era il valore che il menu aveva dal primo giorno, mai messo alla
prova con un tablet vero. **Alzarla non rovescia una scelta — mette alla
prova un valore predefinito che nessuno aveva mai misurato**, ed è la stessa
forma della soglia di tocco corretta il 18/08 (*«non era un rischio accettato:
era un numero sbagliato, una convenzione presa da fuori»*).

⚠️ E la decisione di **non** togliere il menu ovunque è di Alessio, dichiarata
nel mandato: dal computer lo vuole come adesso.
