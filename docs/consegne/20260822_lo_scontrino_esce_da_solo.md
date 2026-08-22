# Lo scontrino esce da solo, e si può rettificare

**Blocco 2 del mandato del registratore**, seconda parte.
**Migrazione `20260822000002`** — ⚠️ applicata **solo al progetto di prova**:
in produzione non è entrato niente, come da regola della sessione.

---

## 1 · La misura: metà del blocco esisteva già

| pezzo chiesto dal mandato | stato misurato |
|---|---|
| «il conto torna fra quelli da fiscalizzare» | ✅ **c'era**: `segnala_scontrino_non_uscito` azzera documento, numero e data |
| «lascia una traccia: chi, quando, il numero» | ✅ **c'era**: `segnalazioni_fiscali` con `segnalato_da`, `segnalato_il`, `stato_prima` |
| «deve rimettere il conto in QUELL'elenco, non crearne un altro» | ✅ verificato con una prova: `conti_da_fiscalizzare` lo ritrova |
| «lo scontrino parte da solo alla chiusura» | 🔴 **non c'era**, ed è il lavoro vero |
| «il gesto sia di Alessio» | 🔴 era **aperto anche allo staff** → rovesciamento n. 30 |

### E lo scarto fra le due giornate

`conti_fiscalizzati_in_ritardo()` confronta `documento_emesso_il` con
`serata_di_servizio(closed_at)` e ne stampa i giorni di differenza. **Non
andava toccato**: bastava che la fiscalizzazione automatica scrivesse la data
giusta.

⚠️ **E la data giusta è la SERATA, non «oggi»** — un conto e il suo documento
devono stare sulla stessa giornata, o la quadratura accusa una differenza che
non esiste. Lo scarto vero nasce da sé nel caso che lo produce: il conto
**chiuso due giorni dopo** (ce n'è uno nello scenario) fiscalizza il giorno
della chiusura, e i due giorni compaiono.

---

## 2 · Lo scontrino parte da solo — e non chiede niente

`fiscalizzaConto()` in `src/lib/fiscalizzazione.js`, agganciata **dentro
`run`** in `CloseOrderModal`.

🔴 **`run` è il punto unico da cui passano TUTTE le chiusure**: contante,
carta, misto, alla romana, sconto. Metterla nei singoli gestori avrebbe
voluto dire cinque copie — e la sesta chiusura che qualcuno aggiungerà domani
sarebbe nata senza scontrino.

⚠️ **Nessuna conferma, nessuna spunta, nessun «hai controllato?»**: è la
decisione di Alessio — *«il sistema deve essere automatico e la rettifica è
solo una via d'uscita per le rare volte che servirà»*. Il flusso normale non
prende attriti in più.

⚠️ **E la chiusura non dipende dalla stampa.** `fiscalizzaConto` **non lancia
mai**: se la stampante è muta, se il protocollo si interrompe, se la scrittura
del documento fallisce, il conto resta chiuso e senza documento — e finisce
nell'elenco che a fine giornata si fa notare da solo. È la regola dello
scarico di magazzino del 13/08: *una scrittura di conseguenza non impedisce
il gesto principale, e il cliente non aspetta.*

### Due casi che NON stampano, e non è una dimenticanza

- **l'annullamento**: non incassa niente;
- **l'omaggio**: incassa **zero**, quindi non c'è corrispettivo da emettere —
  è la stessa riga che `quadratura_fiscale` dice a parole da agosto.
  ⚠️ Lo **sconto** invece incassa una parte, e lo scontrino ci vuole.

### ⚠️ Il caso peggiore, dichiarato invece che taciuto

Se lo scontrino **esce** e il gestionale **non riesce a scriverlo** sul conto,
la funzione lo dice: *«lo scontrino n. X è uscito, ma non sono riuscito a
segnarlo»*. Quel conto resta nell'elenco e **sembra** scoperto senza esserlo.
È il verso meno peggio dei due: l'altro sarebbe un conto segnato a posto
senza che niente sia uscito.

---

## 3 · 🔴 La rettifica è di Alessio — rovesciamento n. 30

Il **20/08** era stato deciso l'opposto, e scritto in due posti: *«la può
fare chiunque sia in sala: chi ha il cliente davanti è chi se ne accorge»*.

**Quella ragione resta vera** — cade la conclusione, non la premessa. Chi si
*accorge* del foglio bianco è ancora il cameriere. Cambia **chi tocca il
dato**, perché da oggi la fiscalizzazione è automatica e la rettifica diventa
**l'unico punto in cui una persona disfa a mano un dato fiscale registrato**.

⚠️ **Il prezzo si paga**: il cameriere deve dirlo ad Alessio, e finché non
glielo dice il conto risulta a posto. Se Alessio non è in sala, la finestra
resta aperta. Il rimedio non è tecnico — è che quel conto resta ritrovabile
in *Cassa → Incassato e scontrinato*, e quell'elenco non si svuota da solo.

⚠️ **La schermata resta in sala, in sola lettura.** Chi serve deve poter
*vedere* se lo scontrino è uscito: toglierla vorrebbe dire che non se ne
accorge nessuno. Al posto del pulsante c'è la riga che dice cosa fare — *un
rifiuto senza gesto d'uscita è un vicolo cieco*, e qui il rifiuto non sarebbe
nemmeno visibile, perché il pulsante semplicemente non c'è.

---

## 4 · Provato col simulatore, nel caso che conta

**8 prove nuove** sui dati veri (più le 17 del simulatore, già consegnate).

| caso | esito |
|---|---|
| giorno buono | scontrino scritto, numero e **data della serata** |
| muto · a metà · errore · non collegato | conto **senza documento**, chiusura intatta, e **nell'elenco** |
| 🔴 **pagina bianca** | conto **a posto** e **sparito dall'elenco** mentre fiscalmente non esiste niente — poi la rettifica lo rimette **in quell'elenco**, azzera anche numero e data, e lascia la traccia |
| rettifica dallo staff | **rifiutata**, col messaggio che dice cosa fare, e **senza lasciare tracce** |
| omaggio | nessuno scontrino chiesto |

### ✅ E la rottura

Fatto in modo che **ogni conto risultasse scontrinato** qualunque cosa
risponda il registratore — il difetto peggiore possibile qui:

> **le quattro prove dei guasti diventano rosse.**

E dentro la migrazione, la controprova all'incontrario: **lo staff è
rifiutato** (senza lasciare tracce) e **il titolare rettifica** (con la
traccia). Senza la seconda, un portiere che rifiuta *tutti* passerebbe
esattamente come uno giusto.

⚠️ **E la prima verifica che avevo scritto era sbagliata**, vale la pena
dirlo: contavo sul fatto che dentro una migrazione `is_titolare()` sia falso,
e mi ero dimenticato che lì `auth.uid()` è **null** — quindi scattava il
controllo *precedente* («serve un accesso») e la verifica passava **senza aver
mai messo alla prova il portiere nuovo**. *Un rifiuto ottenuto per la ragione
sbagliata somiglia in tutto a quello giusto.*

---

## 5 · 🔴 Una rete di casa ha preso il mio codice, e aveva ragione

Il commit è stato **bloccato** dal gancio pre-commit. Il colpevole era una
riga che avevo scritto io:

```js
const serata = await serataCorrente().catch(() => null);
```

`tests/unita/letture.test.js` pretende che ogni `.catch` che ingoia un
guasto o marchi il risultato come **non letto**, o **dichiari perché tace**.
Il mio non faceva né l'una né l'altra cosa.

⚠️ **E aveva ragione nel merito, non solo nella forma**: se quella lettura
fallisce, la data del documento cade su `oggiLocale()` — che nel caso
normale è lo stesso giorno, ma è comunque una cosa che il codice faceva
**senza dirlo**. Adesso c'è scritto il motivo per cui si tace: lì davanti
c'è un cliente che aspetta il resto.

⚠️ **E la seconda metà della rete è quella che vale di più**: l'elenco dei
silenzi dichiarati è **congelato in una prova**, e la mia aggiunta l'ha fatta
diventare rossa una seconda volta. *Un elenco che cresce in silenzio non è
più un controllo* — la stessa forma delle funzioni aperte ad anon. Il mio
silenzio è ora scritto lì, con la sua ragione.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha chiuso un conto** con questa modifica: le prove
   chiamano `fiscalizzaConto` direttamente, **non passano dal modale**. Che
   l'aggancio dentro `run` scatti davvero su tutte e cinque le strade di
   chiusura è letto nel codice, non visto.
2. 🔴 **In produzione non è entrato niente**: la migrazione è solo sulla
   prova, e il codice aspetta il push di Alessio.
3. ⚠️ **Il registratore vero non esiste**: `emettiScontrino` risponde
   `non_collegato`, quindi **in produzione oggi questa modifica non cambia
   niente** — i conti continueranno a finire nell'elenco. Cambierà il giorno
   dell'apparecchio.
4. ⚠️ **Nessun interruttore per scegliere il simulatore fuori dalle prove**:
   il registratore si passa come parametro. Per far provare i guasti ad
   Alessio a schermo servirebbe un pannello, e non è in questo mandato.

---

## Cosa abbiamo rovesciato

**Uno, il n. 30**, ed è al §3: *la segnalazione dello scontrino la fa
chiunque sia in sala* → **la fa il titolare**. Con la ragione di allora che
resta vera, la conclusione che cade, e il prezzo dichiarato.
