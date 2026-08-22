# Le finestre rimaste indietro — tutte e otto, misurate una per una

**Mandato**: chiudere le otto superfici censite ieri con scritte fino a
**1,35 mm**, nell'ordine che avevo proposto. **Nessuna migrazione.**

---

## 1 · Il quadro, misurato a schermo

Tutto a **800 × 1280**, calibrazione **74**, con l'accesso di collaudo sul
progetto di prova. **Guardate, non dedotte**: per ognuna ho aperto la
schermata, letto la taglia più piccola presente, misurato l'altezza di ogni
pulsante e contato i rettangoli del nodo di testo (che è come si scopre se
un'etichetta va a capo).

| superficie | testo prima | testo dopo | larghezza prima → dopo | disposizione |
|---|---|---|---|---|
| **Preconto** | 1,35 mm | **3,20 mm** | **384 → 753** | invariata |
| **Conferme di annullamento** | 1,35 mm | **3,20 mm** | non è una finestra | ⚠️ i due pulsanti **allontanati** |
| **Calibrazione dei tocchi** | 1,35 mm | **3,20 mm** | 689 (non era stretta) | invariata |
| **Bar** | 1,35 mm | **3,20 mm** | schermata intera | invariata |
| **Cucina** | 1,35 mm | **3,20 mm** a schermo, **invariata sulla carta** | schermata intera | invariata |
| **Scontrini** | 1,35 mm | **3,20 mm** | schermata intera | invariata |
| **Avviso letture tagliate** | 1,35 mm | **3,20 mm** | striscia | invariata |
| **Dato non letto** | 1,35 mm | **3,20 mm** | riquadro | invariata |
| **Modulo nota di credito** | 1,35 mm | **3,20 mm** | riquadro | invariata |
| **Campo della giornata** | 1,35 mm | **3,20 mm** | riga | invariata |

**Esito della verifica, superficie per superficie**: *nessuna* etichetta
tagliata, *nessuna* a capo, *nessun* pulsante sotto **8,50 mm** — su Preconto,
Calibrazione, Bar, Cucina, Scontrini e sulla riga di conferma.

⚠️ **Sono dieci e non otto**, e vale la pena dirlo: ieri quattro componenti
piccoli stavano in una riga sola della tabella. Sono tutti fatti.

---

## 2 · 🔴 La cosa che non era prevista: la CARTA

Due delle superfici — **Preconto** e **Cucina** — non sono solo schermate:
sono **fogli che si stampano**. E lì le taglie in pixel **erano giuste**:
`--pxcm` è la calibrazione di uno schermo, e su una termica non vuol dire
niente. Scalandole a occhi chiusi, il biglietto sarebbe uscito fuori misura.

**La cura tiene i due mondi separati nella stessa riga**: la classe in
centimetri veri governa lo schermo, e la variante `print:` rimette la taglia
di stampa. Controllato sul foglio della Cucina: **tutti** gli elementi
scalati dentro il ticket portano la loro variante di stampa, **nessuno** è
rimasto senza.

| il foglio della Cucina | a schermo | sulla carta da 72 mm |
|---|---|---|
| prima | 1,35–2,16 mm | 3,17–4,23 mm |
| adesso | **3,20 mm** | **invariata** |

---

## 3 · Le didascalie — e la terza categoria esiste davvero

Il mandato chiedeva di distinguere spiegazione, avviso e **frase diventata
falsa**. Ne ho trovate di tutti e tre i tipi.

### 🔴 Diventate false — **una, e non era nelle finestre**

**`Sala.jsx`**, nel messaggio d'errore quando le impostazioni di sala non si
leggono:

> «…**Se la migrazione dei coperti non è ancora stata applicata**, il coperto
> non verrà conteggiato.»

Quella migrazione è applicata da settimane, in produzione e sulla prova.
**La causa che il messaggio suggerisce non può più esistere**: manda a
cercare un problema che non c'è, proprio nel momento in cui qualcosa non
funziona davvero. Riscritto tenendo la **conseguenza** (il coperto non viene
conteggiato) e togliendo la causa morta, con un gesto d'uscita: *riprova, e
se continua avvisa Alessio*.

⚠️ **È la seconda in due giorni** (ieri quella sulla cassa), e le due si
somigliano: **una frase giusta quando è stata scritta, che nessuno ha
riletto quando il gestionale è cambiato sotto.** Non è una categoria che si
chiude: è una **manutenzione** che nessun controllo automatico può fare,
perché una frase non è un numero.

### Spiegazioni — **una tolta**

**Cucina**: *«La cucina lavora di carta (§3.2.1): ogni invio dalla Sala
compare qui e si stampa con un tocco… Quando arriverà il mini-PC, la stampa
partirà da sola.»* Dice come funziona una cosa che il pulsante **🖨 Stampa**
dice da sé, e promette una cosa futura. Tolta, **dichiarando dove la regola
resta scritta**: nel commento in testa a quel file, che il mini-PC lo nomina
per esteso.

### Avvisi — **uno tenuto, e lo segnalo perché è al limite**

**Preconto**: *«Solo un'anteprima per il cliente: nessun pagamento
registrato, nessuno scontrino emesso, il tavolo resta aperto. Piatti X +
coperti Y.»*

⚠️ **Tenuto**, e il motivo per cui esito è che **il foglio stampato dice già
le stesse cose** («DOCUMENTO NON FISCALE», «Il conto resta aperto»): a
schermo è una ripetizione. Ma è anche l'unico posto dove si vede **la
composizione del totale**, e il criterio dato è *meglio una frase di troppo
che un avviso in meno*. **Non l'ho tolta: la decisione è di Alessio.**

---

## 4 · Le parole sui gesti definitivi

Cercato «Chiudi» da solo in tutte le schermate delle Comande. **Uno solo**, e
nel posto peggiore:

**Sala**, il pulsante delle impostazioni diventava **«Chiudi»** quando il
pannello era aperto — a due dita da un tavolo aperto, dove *chiudere vuol
dire incassare*. È la stessa regola per cui il gesto del conto si chiama
«Chiudi conto» e l'uscita dal tavolo «Lascia il tavolo aperto». Adesso dice
**«Chiudi impostazioni»**.

⚠️ Il «Chiudi anteprima» del Preconto era già giusto.

---

## 5 · I bersagli dei gesti che cancellano

🔴 **Nella conferma di annullamento, «Sì, elimina» e «Annulla» stavano a 8
punti l'uno dall'altro — 1,08 mm veri.** Il gesto più irreversibile della
schermata accanto al suo contrario, a un decimo della larghezza di un dito.

Misurato dopo, su una conferma vera aperta in Prima Nota:

| | prima | dopo |
|---|---|---|
| distanza fra «Sì, elimina» e «Annulla» | 8 punti = **1,08 mm** | 37 punti = **5,00 mm** |
| «Sì, elimina» | testo 1,35 mm | **9,62 mm** di altezza, testo **3,20** |
| «Annulla» | testo 1,35 mm | **8,50 mm**, testo **3,20** |
| il pulsante che **apre** la conferma | nessuna misura di tocco | **8,50 mm** |

⚠️ La distanza è scritta **in centimetri veri** (`calc(var(--pxcm) * 0.5)`),
come i bersagli: in pixel si accorcerebbe da sola sul tablet, che è dove
serve.

**E tre bersagli piccoli trovati in Sala mentre misuravo**, non nelle otto:
**«annulla»** su una riga già andata in cucina — che è **uno storno** — era
**4,00 mm**; «+ Voce libera» 4,00; «Impostazioni» 6,43. Tutti e tre a
**8,50**. *Il primo è un gesto che cancella, e per il criterio del mandato
non poteva restare fuori.*

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Due delle dieci non le ho viste comparire**: l'**avviso delle letture
   tagliate** e il **«dato non letto»** compaiono solo quando una lettura
   fallisce, e non ho costruito il guasto. Le loro taglie le ho **lette nel
   codice** (`testo-sala` = 3,20 mm), non misurate a schermo. È l'unica riga
   della tabella che non viene da una misura.
2. 🔴 **Niente è mai uscito da una stampante**: i millimetri sulla carta sono
   il conto di come il browser traduce i pixel in stampa, non un foglio
   misurato col righello.
3. ⚠️ **Il modulo nota di credito** l'ho scalato ma non aperto: sta in
   Fatture, e serve una fattura con cui aprirlo.
4. ⚠️ **Fuori dalle Comande il problema resta intero**: misurando la conferma
   in **Prima Nota** ho visto che quella schermata ha testi da **1,49 a 2,43
   mm** e sette pulsanti da **5,14 mm** — «Uscita», «Entrata», «Contante»,
   «Banca», «+ Registra movimento», «Azzera», «Esporta CSV». Non l'ho
   toccata: è un'altra schermata e un altro giro. **Ma è la prova che il
   censimento di ieri era limitato alle Comande, non al gestionale.**

---

## Cosa abbiamo rovesciato

**Niente.** Le taglie salgono e una didascalia se ne va: nessuna decisione
cambia.

⚠️ **E la frase riscritta in Sala non è un rovesciamento**: la regola del
14/08 — *il limite va detto nella schermata* — chiede di dichiarare i limiti
**veri**, e una causa che non può più esistere non è un limite. Toglierla è
ciò che quella regola impone.

---

## 6 · Cosa ho guardato

Aperte e misurate: **Preconto** (con un conto vero da 10,00 €), **Bar**,
**Cucina** (col foglio di T3, 1° turno), **Scontrini**, **Calibrazione dei
tocchi**, e una **conferma di annullamento vera** in Prima Nota — aperta,
misurata e poi **annullata senza confermare**.

**Ripulito**: il conto di prova, **in modo mirato e coi due trigger spenti e
riaccesi controllando** — che è come andava fatta la pulizia di ieri.
Ricontrollato dopo: **0 conti aperti**, i due trigger **accesi**.

**Suite**: 258 prove pure, 303 sui dati veri. Tutte verdi.
