# Consegna del 16/08/2026 (tredicesima) — la coda del mandato: le quattro piccole

**Commit della consegna: `58118bd`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `58118bd` | portieri, sanatorie che parlano, lapidi, Agenda — migrazione `20260816000013` |

⚠️ **`20260816000013` è già applicata in produzione** (§5). La Edge
Function `operazioni-atomiche` è installata **dopo** questo riepilogo: la
rete si è rifiutata di toccare la produzione finché la migrazione non era
documentata — terza volta oggi che interviene su un caso vero.

⚠️ **I due passi vanno insieme**, ed è il motivo per cui sono stati fatti
nella stessa consegna: `completaTask` e `riapriTask` nel sito passano ora
dal corridoio, e col corridoio vecchio in produzione «fatto» e «rimettilo
da fare» in Agenda darebbero errore. Uno stato incoerente che stanotte
non tocca nessuno resta uno stato incoerente.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md` — ed è una
decisione, non un'omissione: vedi §4.

---

## 1. La regola che ha causato il fallimento del Blocco 9

**Dentro una migrazione non si chiamano le funzioni dell'app che hanno un
portiere.** Una migrazione non ha un utente: ha un proprietario, quindi
`auth.uid()` è nullo e la funzione rifiuta. Una sanatoria **legge le
tabelle**; se la funzione serve davvero, si impostano i claims come già
fanno i blocchi di verifica.

`funzioni_col_portiere()` costruisce l'elenco **dal database**, e
`tests/app/migrazioni-senza-portieri.test.js` scandisce le migrazioni
distinguendo tre cose:

| Regione del file | Eseguita durante la migrazione? |
|---|---|
| Corpo di funzione (`as $tag$ … $tag$`) | **no** — è una definizione |
| Blocco `do $tag$ … $tag$` | sì → deve avere impostato i claims |
| SQL fuori da ogni blocco | sì, **senza nessun claim** → è il secondo inciampo del Blocco 9 |

Vale **dalla `20260816000013` in poi**: le migrazioni anteriori non si
riscrivono (Contratto §8), e la soglia è dichiarata nel file invece di
essere aggirata.

⚠️ **La prova ha accusato sé stessa al primo giro, due volte, ed erano
due difetti veri della rete** — entrambi del tipo che l'avrebbe resa
inutile invece che sbagliata, cioè la strada per spegnerla:

1. **il portiere si riconosce dalla forma, non dalla parola**: la
   funzione che cerca `is_titolare` nomina quella stringa, quindi
   finiva nel proprio elenco;
2. **la riga che dichiara una funzione somiglia a una chiamata**: la
   migrazione che crea una funzione col portiere accusava sé stessa.

⚠️ **E il riconoscimento resta un'euristica**, dichiarata dentro il file
su richiesta del validatore: riconosce **due forme** — `if not
is_titolare()` e `if auth.uid() is null` — che sono quelle che il progetto
usa oggi ovunque. Un portiere scritto altrimenti (`is_titolare() = false`,
la chiamata avvolta in un `coalesce`, un portiere delegato a una terza
funzione) **non verrebbe riconosciuto, e la prova direbbe «tutto a posto»
dopo aver guardato solo una parte**. Gli esempi sono elencati lì, e la
forma definitiva — marcare le funzioni nel database invece di dedurre dal
testo — è scritta accanto.

---

## 2. Ogni sanatoria dichiara quante righe ha toccato

Il Blocco 9 è fallito due volte e in mezzo c'era un silenzio: sul
progetto di prova la sanatoria toccava **zero** righe e nessuno lo diceva.

Da qui in avanti il numero si stampa sempre, e **uno zero va riportato nel
riepilogo alla voce «cosa non è verificato»**. Non blocca niente: toglie
il silenzio, che è ciò che ha ingannato quattro volte.

---

## 3. Le tre lapidi, e il guardiano che valeva più della pulizia

La verifica delle mance (`20260816000003`) aveva lasciato in
`deleted_records` due mance e una distribuzione **finte**. Un registro
delle cancellazioni con dentro roba finta è lo stesso problema di una riga
finta in prima nota — solo più difficile da notare, perché nessuno lo
guarda finché non serve.

🔴 **Il guardiano che avevo scritto era sbagliato, e si è fermato al primo
colpo.** Era: *«se non sono esattamente tre, fermati»*. Sul progetto di
prova erano **24**, perché quella verifica si riesegue a ogni
riapplicazione e ne lascia tre ogni volta.

> **Quel numero non era una regola: era una fotografia della produzione di
> quella mattina travestita da regola.**

Al suo posto l'invariante vera: **le cancellazioni autentiche di quelle
tabelle devono essere le stesse prima e dopo — il perimetro non si
allarga.** È vera su tutti e due i database e resta vera domani. È la
stessa forma della lezione del 14/08 (*il controllo finale guarda anche
ciò che è cambiato, non solo ciò che è rimasto*).

⚠️ **La lezione è scritta in `CLAUDE.md` §8**, perché non riguarda solo le
lapidi: *ogni volta che un controllo contiene un numero letto dalla
produzione, quel numero è un fossile.* Chiedersi sempre — **questo
guardiano dice come deve essere fatto il mondo, o com'era il mondo quando
l'ho guardato?**

---

## 4. Le due funzioni dell'Agenda: eccezione, non regola nuova

`completa_task` e `riapri_task` passano ora dal corridoio. Scrivono **una
tabella sola** (`tasks`), quindi il Contratto non le obbligherebbe: ci
passano perché sono tutto-o-niente **per senso** — chiudere un impegno
ricorrente genera il successivo, riaprirlo toglie quello già nato.

⚠️ **Il Contratto §B4 NON è stato allargato**, ed è una decisione di
Alessio su rilievo del validatore. La ragione è che l'allargamento
**romperebbe la rete costruita col Blocco 3**: «scrive più di una tabella»
è misurabile dal database e la prova se ne costruisce l'elenco da sola;
«operazione tutto-o-niente» è un giudizio che nessuna query calcola, e con
quella formulazione l'elenco tornerebbe **scritto a mano in un file di
prova** — cioè invecchierebbe in silenzio, esattamente ciò che quella
prova evita.

**Il perché è scritto dentro la prova**, non solo qui, più un controllo
che verifica che quelle due **restino mono-tabella**: se smettessero di
esserlo, l'eccezione non sarebbe più un'eccezione e andrebbe riaperta la
questione.

⚠️ **La strada pulita per allargare, se il caso si ripresentasse una terza
volta**: marcare le funzioni nel database con un'etichetta che si portano
dietro, così l'elenco resta calcolabile e la rete continua a esistere. È
lavoro vero e oggi non lo vale per un caso solo — ma è scritta da ora.

---

## 5. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 120
righe_registro: 25 | lapidi_di_prova: 0
```

**L'esito del guardiano**, che è la cosa da leggere:

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Righe totali nel registro delle cancellazioni | **25** (erano **28**) |
| Lapidi di prova rimaste | **0** |
| Cancellazioni **vere** di mance nel registro | **0, come prima** |

⚠️ **Righe tolte: 3.** E le cancellazioni autentiche di `tips_collected` e
`tip_distributions` erano zero prima e sono zero dopo: **il perimetro ha
tenuto.** È quella riga a dimostrarlo, non il numero delle righe tolte —
un `delete` che avesse allargato la mano avrebbe fatto scendere anche
quel conteggio, e la migrazione si sarebbe fermata da sola.

**Sul progetto di prova**, prima applicazione della regola nuova: la
sanatoria ha dichiarato **24 lapidi tolte e 36 cancellazioni vere
intatte**, e alle riapplicazioni successive **0 tolte**. Lo zero è
dichiarato invece che taciuto.

**Suite:** 20 pure + **116** sul progetto di prova, tutte verdi (due prove
nuove). Lint a zero, build ok. Migrazione applicata **tre volte di fila**
sul progetto di prova.

---

## 6. Cosa NON è verificato

- **Il portiere della prova è un'euristica**, §1: due forme riconosciute,
  le altre no. È il limite più importante di questa consegna.
- **La prova sui portieri non ha mai trovato una migrazione colpevole**
  fra quelle in perimetro (dalla `…013` in poi ce n'è una sola, questa).
  È provato che non inventa; non è provato che sappia accusare — se non
  contando le **due volte in cui ha accusato sé stessa**, che sono la
  dimostrazione migliore che funziona.
- **`completa_task` e `riapri_task` non sono state esercitate dal sito**
  dopo lo spostamento: la suite le prova, un dito su Agenda no.
- **La pulizia delle lapidi non è ripetibile in produzione**: adesso lì
  non c'è più niente da togliere, quindi una riapplicazione dichiarerebbe
  zero — ed è il comportamento giusto.
