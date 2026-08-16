# Consegna del 16/08/2026 (undicesima) — Blocchi 7 e 8 del mandato di correzione

**Commit della consegna: `fb2c17a`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `fb2c17a` | gli allergeni sul foglio stampato, e i due fili scollegati |

⚠️ **Nessuna migrazione, nessuna Edge Function.** Sono tutte correzioni di
schermata, quindi la produzione non è stata toccata: `npm run migra`
riporta 117 migrazioni, come dopo il Blocco 6.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

Due blocchi in una consegna sola perché nessuno dei due ha una
migrazione e insieme restano leggibili. Del mandato resta il **9** (il
pagamento misto) e le **piccolezze**.

---

## 1. Blocco 7.1 — L'assenza che sembrava una rassicurazione

Nel menu stampato, un piatto con allergeni non confermati **non stampava
la riga allergeni**, mentre tutti gli altri la stampavano.

⚠️ **L'intento era giusto ed è scritto nel codice** — *«un elenco che
sembra controllato e non lo è è peggio di nessun elenco»* — ma il
risultato per chi legge era l'opposto: **in mezzo a delle presenze,
un'assenza dice «questo non contiene allergeni».**

Ora accanto a quel piatto compare **«per gli allergeni chiedi al
personale»**.

⚠️ **La nota generica in fondo alla pagina non basta**, ed è il motivo per
cui il mandato la scarta esplicitamente: c'era già, e **non distingue quel
piatto dagli altri**. Il segno deve stare accanto al piatto.

**Effetto collaterale voluto:** ora l'assenza di righe sotto un piatto ha
un significato solo e vero — *quel piatto è stato controllato e non
contiene allergeni.* Prima ne aveva due, indistinguibili.

L'alternativa che il mandato ammetteva — **non stampare affatto quel
piatto** — è stata scartata: toglierebbe dal menu un piatto che si vende,
per un dato mancante che si compila in un minuto da *Ricettario →
Schede*. Il segno è la cura minima che chiude il difetto.

---

## 2. Blocco 7.2 — L'inserto che non diceva niente

`PiattiDelGiorno.jsx` non riportava **nulla** sugli allergeni, nemmeno la
frase generica che il menu principale ha in fondo. ⚠️ E i piatti del
giorno sono proprio quelli con **pesce, crostacei e frutta secca** — cioè
quelli su cui la domanda si pone davvero.

Ora la frase c'è, in fondo all'inserto stampato.

⚠️ **Resta generica apposta, e la ragione va scritta:** le voci
dell'inserto possono essere **testo libero** (`custom_name`) senza nessuna
ricetta dietro. Per metà di loro il gestionale **non sa** quali allergeni
contengano. Stampare un elenco per le une e non per le altre rifarebbe
qui, identico, il difetto appena chiuso sul menu principale — un'assenza
che si legge come una rassicurazione.

---

## 3. Blocco 8.1 — Il fornitore che non si poteva scegliere

🔴 In `PostaInArrivo.jsx` la lista fornitori era chiesta con
`listSuppliers()` **senza indicare la società**, mentre ovunque altrove è
`listSuppliers(entities.srls.id)`. La chiamata falliva, **l'errore era
ingoiato da un `catch` vuoto**, e il menu «Fornitore» del carico da
fattura era **sempre vuoto** — senza che niente lo dicesse.

**Le conseguenze non finivano nel menu**, e sono quelle che rendono questo
il rilievo più costoso dei due:

| Cosa | Perché conta |
|---|---|
| Gli ingredienti nuovi vengono intestati alla **prima entità trovata** | possono finire sull'**agricola** invece che sulla S.r.l.s. — il vincolo portante del progetto |
| La memoria delle diciture finisce in un secchio generico | il riconoscimento alla seconda fattura smette di funzionare per fornitore |
| Lo storico prezzi perde il «da chi» | è ciò su cui si regge la **sorveglianza dei rincari** |

**Cura in due pezzi**, entrambi necessari: l'entità si passa (letta da
`getEntities()`), **e il `catch` muto non c'è più**. ⚠️ *Un errore che
nessuno vede è peggio di un errore*: senza la seconda metà, la stessa
cosa potrebbe ricapitare domani e restare invisibile allo stesso modo.
Anche il caricamento degli ingredienti, che aveva lo stesso `catch`
vuoto, ora mostra l'errore.

---

## 4. Blocco 8.2 — Il calendario che non mostrava il pericolo che annuncia

Sopra la tabella «Quando escono i soldi» c'è scritto, testuale: *«è la
cassa di giugno che tradisce, quando il saldo dell'anno prima e il primo
acconto cadono insieme»*. E `calendarioImposte` veniva chiamata **senza il
quarto parametro** — le imposte dell'anno precedente — che la funzione del
database sa usare: **il ramo c'è ed era spento.**

Cioè la schermata **annunciava un pericolo e poi non lo mostrava**.

**Da dove arriva ora il numero:** dalla previsione dell'**anno
precedente** della stessa società, preferendo quella **congelata** — una
previsione chiusa è l'unica che non cambierà più, quindi è l'unica base
onesta per un saldo da pagare.

⚠️ **E quando non c'è, la schermata lo DICHIARA** invece di mostrare un
giugno leggero: *«Il saldo dell'anno prima NON è compreso: non c'è nessuna
previsione dell'anno precedente da cui prenderlo. Giugno sarà più pesante
di così.»* È la stessa forma dell'avvertenza che viaggia col numero in
`calcola_imposte()` — e senza quella frase la correzione avrebbe risolto
metà del difetto, lasciando in piedi proprio la parte pericolosa.

---

## 5. Cosa è stato verificato, e cosa no

**Verificato:** lint a zero, build ok, suite intera **20 pure + 114 sul
progetto di prova, tutte verdi**. Nessuna migrazione da applicare, quindi
niente numeri di produzione da riportare: `applied_migrations` resta a
**117**.

⚠️ **Cosa NON è verificato, ed è quasi tutto:**

- **Nessun menu è mai stato stampato.** Il difetto 7.1 è dedotto
  leggendo il codice (`daVerificare` → elenco vuoto → nessuna riga
  stampata) e la cura è verificata solo dal fatto che l'app compila. Il
  Ricettario è vuoto: non esiste nessun piatto, quindi non esiste nessun
  menu da mandare in stampa.
- **L'inserto dei piatti del giorno non è mai stato generato.**
- **Nessuna fattura è mai passata dalla posta con un fornitore vero.** Il
  difetto 8.1 è stato letto nel codice; che il menu fosse vuoto in
  pratica non è stato osservato su uno schermo, perché nessuna mail con
  fattura è in attesa adesso. ⚠️ **Il difetto spiega però una cosa già
  vista**: le 12 diciture di `articoli_fornitore` in produzione hanno
  tutte il fornitore vuoto, e finora era attribuito al fatto che i
  fornitori non esistevano ancora quando le fatture di collaudo sono
  entrate (12-13/08). **Ora si sa che il menu sarebbe stato vuoto
  comunque**, anche se i fornitori fossero già esistiti. Le due
  spiegazioni non si escludono, ma la seconda era invisibile.
- **Il calendario delle imposte con il saldo dell'anno prima non è mai
  stato visto**: in produzione non c'è nessuna previsione, quindi nemmeno
  una dell'anno precedente da cui leggere le imposte. Oggi quella
  schermata mostrerebbe la frase «non è compreso» — che è il
  comportamento giusto, e l'unico osservabile.

---

## 6. Una cosa che questa consegna lascia aperta

⚠️ **Il difetto 7.1 non tocca la scheda ricetta dello staff**, dove
l'avviso «allergeni da verificare» c'era già dal 13/08 ed è corretto. È
solo il **menu del cliente** a essere cambiato.

⚠️ **E non è stato toccato `v_recipe_allergens`**: la vista continua a
dichiarare `allergeni_da_verificare`, e la decisione di non stampare
l'elenco resta quella del 13/08. Qui è cambiato **cosa si vede al posto
dell'elenco**, non quando lo si nasconde.
