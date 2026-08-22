# Quello che sta fuori dalle schermate — il censimento che mancava

**22/08/2026** · voce **0-bis** della coda, decisa da Alessio.
**Una misura. Non ho corretto niente** — tranne quello che era già stato
corretto stamattina, che è dichiarato riga per riga.

Fatto **aprendo** il gestionale sul progetto di prova, calibrazione **74**, in
**tre stati**: schermo stretto (800) col menu chiuso, schermo stretto col menu
**aperto**, e schermo largo (1400) dove la barra è sempre visibile.

**Il criterio è lo stesso del primo censimento**: testo ≥ 3,20 mm, bersagli
≥ 8,50 mm, gesti pericolosi distanti ≥ 5 mm.

---

## 🔴 Perché questo censimento esiste

> **Un difetto che sta dappertutto non compare in un elenco fatto per posti.**

Il censimento del 22/08 ha aperto **67 schermate una per una** guardando
dentro `<main>` — cioè *la schermata*. Il pulsante «Apri menu» (**5,14 mm**) e
le 17 voci della barra (**5,07 mm**) stavano **fuori**: non erano in nessuna
delle 67 righe perché non erano in nessuna schermata **ed erano in tutte**.

⚠️ **Il perimetro dello strumento non si vedeva dai risultati**, ed è la parte
che vale oltre il caso: un elenco di 67 righe verdi e rosse *sembra* un
censimento completo. Nessun numero, in quell'elenco, diceva «e poi c'è tutto
il resto».

---

## 1 · Il telaio — misurato in tre stati

| pezzo | dove sta | testo | bersaglio | esito |
|---|---|---|---|---|
| pulsante **«Apri menu»** | testata, solo schermi stretti | (icona) | **8,50 × 8,50** | ✅ *(era 5,14 — corretto stamattina)* |
| **17 voci del menu** | barra, e sul tablet è il menu che si apre | **3,20** | **8,50** | ✅ *(erano 1,89 / 5,07 — corrette stamattina)* |
| **«Esci»** | in fondo alla barra | **3,20** | **8,50** | ✅ |
| **«Moduli»** — l'etichetta della sezione | barra | **1,49** | non è un bersaglio | 🔴 **rossa** |
| **velo scuro** che chiude il menu | sopra la pagina | — | 171 × 67 mm | ✅ enorme per costruzione |
| **logo** | testata e barra | 1,89 / 2,16 | non è un bersaglio | ⚠️ *(vedi §3)* |

**Fuori da `<main>` in tutto**: 1 elemento a menu chiuso, **37** a menu aperto,
**35** sul computer. **Un solo testo sotto soglia** in tutti e tre gli stati.

---

## 2 · Gli avvisi che compaiono sopra qualunque pagina

⚠️ **Questi non si vedono aspettando: si accendono.** Ho acceso davvero
l'avviso delle letture tagliate importando la sua funzione dal browser
(`segnalaLetturaTagliata`), l'ho misurato, e l'ho spento.

| avviso | come l'ho visto | testo | bersaglio | esito |
|---|---|---|---|---|
| **«Quello che vedi è incompleto»** (letture tagliate) | **acceso davvero** e poi spento | **3,20** | **8,50** | ✅ |
| **«dato non letto»** | 🔴 **letto nel codice, non acceso** | `testo-sala` = 3,20 | `tocco-bottone` = 8,50 | ✅ *dichiarato* |

⚠️ **La differenza fra le due righe è tutto il valore di questo referto**: la
prima è una misura, la seconda è una lettura. Per accendere «dato non letto»
serve far fallire una lettura dentro una schermata, e non l'ho costruito.

---

## 3 · 🔴 Il pallino del database — e un criterio che non c'è

| | |
|---|---|
| dove | in basso a destra, **fisso**, su ogni schermata del gestionale |
| misura | **2,16 × 2,16 mm** |
| è un bersaglio? | **no** — non si preme, non ha testo |
| criterio che gli si applica | **nessuno dei tre** |

🔴 **Non l'ho toccato, e la ragione non è prudenza: è che quel numero è una
decisione di Alessio, non una dimenticanza.** Il 21/08 la striscia in cima è
diventata un pallino apposta, *«perché la fascia rubava spazio verticale, e sul
tablet in verticale quello spazio è la cosa che si sta misurando»*. Ingrandirlo
riaprirebbe il problema che quella decisione ha chiuso.

⚠️ **Ma il censimento deve dire che qui il criterio manca.** I tre criteri
parlano di *leggere* e *premere*; il pallino serve ad **accorgersi quando
cambia**, ed è una terza cosa. La domanda giusta non è «è grande 8,5 mm?» ma
**«ci si accorge che è cambiato colore mentre si lavora?»** — e a quella
risponde una mano, non un numero.

⚠️ **E c'è un precedente esatto**: il 16/08 la stessa domanda era già stata
sbagliata una volta. La prima versione era una targhetta in basso a sinistra,
e Alessio l'ha vista *«solo perché la stava cercando»*. Il criterio che ne
uscì — **«notata senza cercarla»** — è quello che vale qui, e non è fra i
nostri tre.

---

## 4 · I pezzi condivisi che vivono dentro le schermate

Non sono «fuori dalle schermate» in senso stretto, ma valgono per la stessa
ragione: **stanno in un posto solo e si vedono in cinquanta**.

| pezzo | stato | note |
|---|---|---|
| `ConfermaDistruttiva` | ✅ 3,20 / 8,50, **5 mm** fra «Sì, elimina» e «Annulla» | sistemato stamattina |
| `CampoGiornata` | ✅ 3,20 | ⚠️ le etichette gliele passa **la schermata**, non lui |
| `CampoAutosalvato` | ⚠️ **nessuna taglia propria** | eredita dalla schermata: sta bene dove la schermata sta bene |
| `Icon` | — | disegno, nessun testo |
| **`PrintButton`** | 🔴 **`text-sm` = 1,89 mm**, nessuna misura di tocco | ⚠️ è dentro `print:hidden`, quindi **sullo schermo**, non sulla carta |
| **`FormNotaCredito`** | 🔴 due residui: `text-sm` sui campi e **`text-[11px]` = 1,49** sulle etichette | sono in **costanti** (`inputClass`, `labelClass`) |
| `Logo` | 1,89 / 2,16 / 2,70 | non è un bersaglio |

---

## 5 · Il conto

| | |
|---|---|
| pezzi che vivono fuori dalle schermate | **6** (testata, barra, velo, logo, pallino, avviso letture) |
| **rossi** | **1** — l'etichetta «Moduli» a 1,49 mm |
| pezzi condivisi dentro le schermate | 7 |
| **rossi** | **2** — `PrintButton` e `FormNotaCredito` |
| senza criterio applicabile | **1** — il pallino del database |
| misurati aprendo | tutti tranne **«dato non letto»** |

🔴 **Tre righe rosse in tutto**, e nessuna delle tre era nel censimento delle
67 schermate: due stanno in componenti condivisi, una nel telaio.

⚠️ **E `PrintButton` è quello che mi convince di più a non correggerlo
adesso**: è il pulsante «Stampa» di **dieci schermate**, comprese quelle che
finiscono sulla carta. Toccarlo tocca il referto della carta che una sessione
parallela ha appena consegnato senza correggere niente.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **«Dato non letto» non l'ho acceso**: le sue misure vengono dal codice.
2. 🔴 **Non l'ha visto un occhio**: nessuna fotografia, solo misure.
3. ⚠️ **Il velo del menu l'ho misurato, non premuto**: che chiuda il menu è
   quello che dice il codice.
4. ⚠️ **Gli stati sono tre, non tutti**: non ho misurato il telaio **con una
   finestra aperta sopra**, né sulla pagina pubblica (dove il pallino non
   compare per decisione del 21/08).
5. ⚠️ **Il criterio del pallino manca**, §3: non è un difetto del pallino, è
   un buco nei criteri.

---

## 6 · Cosa serve da Alessio

1. **Le tre righe rosse**: le sistemo? Sono un giro corto — l'etichetta
   «Moduli», il pulsante «Stampa» condiviso, e le due costanti del modulo
   nota di credito.
2. 🔴 **Il pallino**: *ti accorgi che è cambiato colore mentre lavori?* Se la
   risposta è no, la cura **non** è ingrandirlo (riaprirebbe il problema dello
   spazio che hai chiuso il 21/08) — è cambiargli qualcos'altro. Se è sì, non
   si tocca e questa riga si chiude.
3. Restano **quattordici push** in coda.
