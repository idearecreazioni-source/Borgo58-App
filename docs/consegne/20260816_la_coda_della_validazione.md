# Consegna del 16/08/2026 (quinta) — la coda della validazione

**Commit della consegna: `61f3c5a`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `f627ee7` | la coda della consegna: quattro rilievi della validazione |
| `61ae979` | `CLAUDE.md`: il campo che si vede ma non arriva |
| `61f3c5a` | il nome della funzione, che il terminale aveva mangiato |

**Nessuna migrazione.** Produzione invariata a **111 migrazioni**: sono
correzioni di codice client e di uno script.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

---

## 1. 🔴 Le mance su carta venivano registrate come contanti

Il menu «contanti / carta» sulla raccolta **c'era, si vedeva e si
conservava** nello stato del modulo — ma `handleCollect` non passava
`mezzo` nel payload. Il database applicava il predefinito `contanti`.

**Cosa sarebbe successo**: ogni mancia incassata con carta entrava nel
contante atteso del cassetto **senza esserci fisicamente**. Al primo
conteggio sarebbe risultato un ammanco pari alle mance su carta, e quella
differenza — dal Blocco 6a — **genera un movimento vero in prima nota**.
Cioè esattamente il difetto che la migrazione di ieri dichiarava di aver
chiuso, **col segno rovesciato**.

Sulla distribuzione `mezzo` viaggiava correttamente: era solo la raccolta.

### ⚠️ Chiuso dove può essere provato, non solo dove si è rotto

Aggiungere il campo mancante avrebbe risolto **questo** caso e lasciato
aperta la classe. L'elenco dei campi si costruisce ora in
**`payloadMancia()`**, una funzione pura, invece di essere un oggetto già
pronto passato dalla schermata: così quello che manca **si vede
leggendo**, e una prova lo può controllare.

**4 prove pure nuove (14 → 18)**, fra cui una che confronta l'elenco dei
campi **per intero**: diventa rossa da sola se un domani qualcuno aggiunge
un campo e si dimentica di passarlo.

### La copertura di quel confine, dichiarata

⚠️ **Le 98 prove sul database non potevano prenderlo**, e non per una
dimenticanza: esercitano il database, non il tratto **fra schermata e
database**. Quel tratto era scoperto e ora ha una prova — ma solo per le
mance. **Resta scoperto altrove**, e questa è la parte che vale la pena
tenere a mente: il pericolo è dove un campo dimenticato **sbaglia in
silenzio invece di dare errore**, cioè ovunque il database abbia un
predefinito plausibile. La regola generale è in `CLAUDE.md` §8.

---

## 2. La spiegazione che non sommava più al numero

`saldo_tesoreria` da ieri restituisce `mance_in_cassa` e `di_cui_non_tuo`,
e il numero grande le comprende. Ma la riga sotto continuava a dire «fondo
+ incassi − uscite + di sala»: **dalla prima mancia in contanti la
scomposizione non sommava più al totale**.

L'avvertenza dal database lo diceva a parole, ma **un numero e la sua
spiegazione che si separano** sono la famiglia di difetti che questo
progetto combatte apposta — la stessa del saldo di cassa che escludeva gli
incassi di sala.

Aggiunta la voce delle mance nella scomposizione, e mostrato
`di_cui_non_tuo` **come dato e non solo come frase**: è il numero per cui
quella colonna è stata creata.

---

## 3. La rete che si poteva saltare in silenzio

In `funzione.mjs` il controllo dei riepiloghi stava dentro un
`if (urlProduzione)`: **senza `DB_URL_PRODUZIONE` nel `.env.db` la rete non
scattava e non lo diceva**. In `migra.mjs` l'url era già obbligatorio.

Chiusa l'asimmetria con `obbligatorio()`, che ferma il programma con un
messaggio. *Una rete che si disattiva quando manca una variabile è una
rete che non c'è* — e ci si sarebbe accorti solo dopo, guardando cos'è
finito in produzione senza riepilogo.

---

## 4. Il controllo all'indietro — esito

Cercate in **tutte le 78 verifiche già applicate** le scritture su righe
che la prova non aveva creato.

| Passaggio | Righe |
|---|---|
| `update` / `delete` dentro i blocchi `do $verifica$` | **171** |
| tolte quelle con marcatore di prova o anno finto | — |
| tolte quelle identificate da una **variabile locale** (righe create dalla verifica) | **18** |
| di queste, che toccano davvero righe preesistenti | **2 famiglie** |

Le due famiglie: **`stato_lavori`** (allarmi, 10/08) e
**`lavori_sorvegliati`** (battito dei lavori, 12/08). Entrambe scrivono su
righe vere per provare la sentinella — spegnere un battito, togliere un
lavoro dall'elenco — e quindi sono esattamente la forma pericolosa.

**Verificate in produzione, che è la prova decisiva:**

| Cosa | Stato |
|---|---|
| lavori sorvegliati | **5**, tutti presenti (`lettura_posta, promemoria_agenda, pulizia_posta, pulizia_richieste, scadenze`) |
| battiti registrati | **5**, con orari plausibili (posta 13 min fa, agenda 3 min, pulizie notturne ~7 h, scadenze 10:00) |
| lavori pianificati | **6** |
| avvisi degli ultimi 4 giorni | **9**, tutti legittimi — rincari veri e il falso allarme del 12/08 già documentato |

**Esito: negativo. Le verifiche avevano rimesso a posto ciò che avevano
toccato, e nessun avviso è stato generato da una verifica.** Il caso del
detergente resta l'unico trovato.

### ⚠️ Il limite del controllo, dichiarato

Guarda le sole scritture **dentro i blocchi `do $verifica$`**, e riconosce
«riga creata dalla prova» dal fatto che sia identificata da una variabile
locale. **Una verifica che avesse modificato una riga vera passando
comunque da una variabile non verrebbe vista** — è il caso del detergente,
che infatti è stato trovato leggendo la giacenza e non con questa ricerca.
Il controllo restringe il campo, non lo chiude.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| prove pure | **18 verdi** (erano 14) |
| prove sul database | **98 verdi**, invariate |
| lint, build | puliti |
| `npm run funzione` in sola lettura, produzione e prova | **entrambe funzionano** |
| produzione | **111 migrazioni**, invariata: nessuna migrazione in questa consegna |

---

## 6. Cosa NON è verificato

- ⚠️ **Nessuna mancia è mai stata registrata dalla schermata**, quindi il
  difetto non ha mai prodotto un dato sbagliato in produzione: `mance` e
  `tip_distributions` sono a **zero righe**. La correzione arriva prima
  del primo uso.
- **Il riquadro del contante con le mance dentro non è stato visto**: in
  produzione non ci sono mance, quindi la voce non compare ancora.
- ⚠️ **Il confine schermata → database resta scoperto altrove.** Solo le
  mance hanno ora una prova su quel tratto. Gli altri punti in cui un
  campo dimenticato sbaglierebbe in silenzio non sono stati censiti — è un
  lavoro che vale la pena fare, e non è stato fatto qui.
- **Le migrazioni non sono state rilette una per una** oltre alla ricerca
  automatica descritta in §4, coi limiti che ha.
