# I turni dei pasti — la comanda si scompone, la cucina stampa per turno

**Mandato**: i turni dei pasti, dopo il referto di misura
([`20260821_i_turni_dei_pasti.md`](../referti/20260821_i_turni_dei_pasti.md),
commit `39dd62b`).
**Commit del codice**: `84527bb` · **working tree pulito** al momento di
scrivere questo riepilogo, che è l'ultimo commit della consegna.
**Migrazione**: `20260821000001_i_turni_dei_pasti.sql` — **applicata al solo
progetto di prova**, **non in produzione**: aspetta il push di Alessio
(`npm run migra` si rifiuta finché non è su GitHub).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuno l'ha visto con gli occhi**: il pannello del browser non è
   mostrato in questa sessione, quindi **non esiste una fotografia** di
   nessuna di queste schermate. Quello che ho fatto è *interrogarle* — vedi
   §6, dove c'è scritto riga per riga cosa ho chiesto e cosa ha risposto.
   Se il numero del turno sia **leggibile in servizio**, e se il foglio si
   distingua a colpo d'occhio da quello del turno accanto, resta una
   domanda per Alessio.
2. 🔴 **Il biglietto non è mai uscito da una stampante**: la coda di stampa
   non esiste (§4) e la termica nemmeno. Quello che ho guardato è
   l'anteprima a schermo, che è la stessa impaginazione — ma non è carta.
3. ⚠️ **Il Bar non è stato toccato**, ed è una scelta: raggruppa ancora per
   invio. Un turno è una cosa della cucina — le bevande escono quando
   escono — e Alessio ha nominato solo la cucina. **Se un domani si vorrà
   anche lì, la regola è già pronta e sta in un posto solo.**
4. ⚠️ **Un turno sbagliato non ha un «torna indietro»**: si corregge
   togliendo la riga e rimettendola, che è il gesto che esiste già. Non è
   stato chiesto niente di più, e non l'ho aggiunto.
5. ⚠️ **Il tocco su un tavolo dalla pianta**, dopo aver ricaricato la
   pagina, non mi rispondeva più (§6, ultima riga): è un limite del modo in
   cui comando il browser da qui, **non un difetto dell'app** — prima del
   ricaricamento gli stessi tocchi hanno aperto il tavolo e composto tre
   turni. Ma è onesto dirlo: l'ultimo caso (l'**AGGIUNTA**) l'ho prodotto
   scrivendo la riga da uno script, non col dito.

---

## Cosa abbiamo rovesciato

**Una cosa sola, ed era scritta nel codice dal 09/08**: *«un ticket è un
INVIO»*. Ora è un **turno**. Racconto per esteso e le quattro righe di rito
in [`decisioni_rovesciate.md` n. 26](../decisioni_rovesciate.md); qui la
sintesi:

- **cosa era stato deciso**: il foglio della cucina raggruppa le righe
  partite insieme (`order_id + sent_at`), 09/08/2026;
- **la ragione di allora**: non esisteva nessun'altra unità — l'invio *era*
  il turno, solo che nessuno l'aveva chiamato così;
- **cosa si decide adesso**: il foglio è un turno (`order_id + turno`);
- **perché quella ragione non vale più**: l'unità si è sdoppiata, e
  misurando si vede che sbagliava **nei due versi** (§1).

⚠️ **E c'è una nota sull'elenco stesso**: la voce precedente è intestata
**18** ed è la **seconda** con quel numero. Non l'ho rinumerata — è una riga
già consegnata — ma va sistemata: quell'elenco serve a rispondere *«questa
decisione l'abbiamo già rovesciata prima?»*, e due voci con lo stesso numero
rompono proprio quel conteggio.

---

## 1 · Perché il turno non poteva appoggiarsi all'invio

È la domanda che il mandato chiedeva di misurare **prima** di scrivere, ed è
già nel referto. La ripeto qui perché è la ragione di tutto il resto, e
perché sbaglia in due direzioni opposte:

| il gesto | cosa faceva prima | perché |
|---|---|---|
| segno tutta la comanda e mando una volta | **un foglio solo**, coi tre turni dentro | `sendDraftItems` scrive **un solo istante** su tutte le righe, e `handleSend` gli passa tutte quelle non ancora inviate |
| aggiungo un piatto **dello stesso turno** dieci minuti dopo | **due fogli**, indistinguibili da due turni | l'istante è diverso |

⚠️ **Il primo è il gesto normale**, non un caso limite: è così che si prende
una comanda a un tavolo che ordina tutto insieme. La cucina avrebbe visto il
dolce sullo stesso foglio dell'antipasto.

---

## 2 · Il turno è un dato della riga, e lo compone chi serve

`order_items.turno`, `smallint not null default 1`, vincolo `turno >= 1`.

🔴 **Non si deduce MAI dalla categoria del piatto.** Nel primo turno di
Alessio ci sono **due antipasti e una pasta**: i turni li compone lui,
secondo come vuole far mangiare quel tavolo. ⚠️ Una regola che li ricavasse
dalla portata sbaglierebbe **in silenzio** — e sembrerebbe giusta a chiunque
non fosse a quel tavolo. Nel codice non c'è nessuna riga che guardi la
categoria.

⚠️ **Il predefinito 1 è una risposta, e qui è quella giusta**: tutte le
comande scritte prima di oggi sono di un turno solo, perché i turni non
esistevano. Non è un valore comodo messo al posto di una scelta — è il fatto.

**In sala**: accanto al menu c'è **«1° turno»** e il pulsante **«Prossimo
turno»**. Si segnano i piatti, si preme, e da lì in poi quello che si segna
va nel turno dopo.

⚠️ **Il turno in corso si vede sempre**, e non è decorazione: dopo due tocchi
non si saprebbe più dove stanno finendo i piatti — ed è la cosa che chi serve
deve sapere **mentre il cliente parla**.

⚠️ **E riparte da uno a ogni conto**: è una proprietà della comanda che si
sta scrivendo, non dello schermo.

**Nella comanda** i turni si separano con una riga di stacco — «2° TURNO»,
«3° TURNO» — ⚠️ **solo quando sono più di uno**: su una comanda che esce
tutta insieme, un «1° turno» solitario sarebbe una parola in più che non
separa niente. ⚠️ E **dentro il turno vengono prima le righe già inviate**:
quello che si sta segnando adesso resta in fondo al suo turno, dove sta anche
il dito. *Prima l'ordine era «tutte le bozze, poi tutte le inviate»: coi
turni quella separazione racconterebbe una comanda che non esiste.*

---

## 3 · Cosa vede la cucina

Un foglio per turno, e l'intestazione dice **sempre** a quale appartiene —
anche quando è il primo.

⚠️ **Il «sempre» è la condizione posta da Alessio**, non un vezzo. Un piatto
aggiunto a un turno **già stampato** fa un foglio **suo**, con dentro solo
lui: rimettere anche le righe vecchie farebbe ricucinare roba già fatta. Lui
ha accettato quel caso *a patto che il foglio dica chiaramente di che turno
si tratta* — altrimenti chi cucina non sa se ha in mano roba nuova o roba già
fatta. Per questo compare anche la parola **AGGIUNTA**.

Visto davvero (§6):

```
CUCINA — T5 · T6        CUCINA — T5 · T6        CUCINA — T5 · T6
1° turno                3° turno                2° turno · AGGIUNTA
1× Caponata             1× Cannolo scomposto    1× Contorno di verdure
1× Sarde a beccafico
1× Busiate al pesto
```

---

## 4 · «Avanti col prossimo turno» — ed è costruito per una coda che non esiste

**Il pulsante** sta fra i gesti del tavolo aperto, insieme a Invia, Preconto,
Chiudi conto e Annulla tavolo: è un gesto **del tavolo**, non del menu. Manda
in cucina un foglio con la frase e il numero del tavolo.

🔴 **Generico e senza limitazioni, per sua decisione**: non conta i turni, non
si spegne quando sono finiti, non impedisce di premerlo due volte. **La
cucina ha già la comanda completa e vede da sé cosa resta da cucinare** — il
biglietto dice solo «adesso». La versione che dichiarava quale turno stava
chiamando e si spegneva alla fine è stata **scartata da lui**, ed è scritto
nel codice perché nessuno la rimetta credendo di migliorare qualcosa.

⚠️ **Non dipende dall'aver inviato**: si chiama il prossimo turno anche su una
comanda mandata in cucina tutta insieme all'inizio — che è precisamente il
caso per cui esiste.

**Il rifiuto sta nel database**: un biglietto per un conto che non è aperto è
carta sprecata in cucina, e la schermata non è l'unica porta.

### La coda di stampa: misurata, e non c'è

Il mandato chiedeva di **misurare prima** se la coda di ARCHITETTURA §4.2
esiste, e di dire cosa costerebbe invece di costruirla. Misurato sul database
e sulle 166 migrazioni: **nessuna tabella di coda di stampa esiste**, con
nessun nome.

**Quindi il biglietto è stato costruito con la forma della coda**, che è
tutto ciò che si poteva fare senza costruirla:

| la regola §4.2 | come è già rispettata |
|---|---|
| l'app scrive la richiesta in una tabella | `chiamate_turno` (conto, chi, quando) |
| l'agente legge, stampa e segna l'esito | `stampata_il` — oggi lo scrive il gesto di chi preme «Stampa» |
| stampante spenta → la riga resta in coda, visibile | il biglietto resta fra «da stampare» finché non esce, senza scadenza |
| nessuna attesa sincrona, nessun dato perso | l'inserimento non aspetta niente e non fallisce se nessuno stampa |

⚠️ **E la Cucina lo tratta come gli altri fogli** — stessa vita, stesso
gesto, stessa marcatura, stessa ristampa. *Il giorno del mini-PC la coda li
prende senza doverli distinguere, perché non c'è niente da distinguere.*

**Cosa costerebbe la coda vera** (non costruita): una tabella sola per tutti i
documenti (`documento`, `payload`, `stato`, `tentativi`, `errore`), il
passaggio dei tre tipi di foglio dentro quella tabella invece che dedotti
dalle righe, e l'agente sul mini-PC che la legge. ⚠️ **La parte che non è
lavoro di codice è la scelta dell'apparecchio**, ed è già scritta in
`CLAUDE.md`: un modello che non sa dire quando **non** ha stampato lascia
scoperto il caso che conta.

---

## 5 · Le prove, e le due rotture fatte apposta

**11 prove pure** (`tests/unita/turni.test.js`) e **7 sui dati veri**
(`tests/app/turni-dei-pasti.test.js`). Suite intera verde: **241 pure**,
**299 sul progetto di prova**.

⚠️ **Il numero degli elementi è scelto perché discrimini** (regola del
19/08). Le risposte sbagliate possibili sono due e opposte — «raggruppo per
invio» e «faccio un foglio per riga» — e con un piatto per turno sarebbero
indistinguibili dalla giusta. Le prove usano **3 + 2 + 1**.

⚠️ **La prova sui dati veri esiste per il tratto fra database e regola**, che
le prove pure non possono vedere: quelle si inventano righe *della forma che
il codice si aspetta*. Legge le righe con **la stessa select della Cucina** e
controlla che il `turno` arrivi davvero — se quella select smettesse di
riportarlo, la cucina stamperebbe tutto come «1° turno» **senza nessun
errore**.

**Le due rotture** (fatte, non promesse — e poi rimesse a posto):

| cosa ho rotto | quale prova è diventata rossa |
|---|---|
| la chiave torna `order_id + sent_at` | *«una comanda mandata tutta insieme esce in tre fogli»* — e **solo quella** |
| `aggiunta` non si calcola più | *«un piatto aggiunto a un turno già stampato…»* — e **solo quella** |

---

## 6 · Cosa ho guardato, e cosa ho visto

⚠️ **Non ho digitato nessun PIN.** L'accesso di collaudo che Alessio mi ha
dato il 21/08 vive in un file; un PIN digitato in una finestra finirebbe per
intero nella trascrizione della sessione, quindi la sessione l'ha aperta uno
script che la chiave la legge e la usa **senza farmela passare davanti**, e
il gettone temporaneo è stato cancellato subito dopo. **Sul solo progetto di
prova**: controllato che l'identificativo del database non fosse quello vero
prima di qualunque cosa, e sullo schermo c'era il segno del progetto di
prova.

Fatto **coi gesti veri della schermata**, in quest'ordine:

1. **Toccato T5** → si è selezionato **T5 · T6** (sono accostati: il
   tavolone si prende intero, com'è giusto) e il pannello è comparso dentro
   la pianta.
2. **«Apri 2 tavoli»** → conto aperto, e nella colonna dei gesti c'erano
   tutti e sette i pulsanti, **«Avanti prossimo turno» compreso**; accanto al
   menu **«1° turno»** e **«Prossimo turno»**.
3. **Segnati tre piatti**, premuto «Prossimo turno» → l'etichetta è passata a
   **«2° turno»**; altri due piatti, premuto ancora → **«3° turno»**; un
   dolce.
4. **La comanda si è mostrata così**: `1° TURNO` con tre piatti, `2° TURNO`
   con due, `3° TURNO` con uno. Il totale a **0,00 €**, che è giusto: dal
   16/08 una bozza non entra nel conto.
5. **«Invia (6)»** → sei righe partite **con un solo istante**, cioè
   esattamente il caso che prima usciva accorpato. Totale **77,00 €**.
6. **«Avanti prossimo turno»** → sotto il pulsante è comparso *«Mandato in
   cucina: avanti col prossimo turno per T5 · T6.»*
7. **Aperta la Cucina**: **«4 da stampare»** — tre fogli, uno per turno, e il
   biglietto **AVANTI COL PROSSIMO TURNO** col tavolo e l'ora.
8. **Premuto «Stampa» sul 2° turno** (la finestra di stampa neutralizzata,
   per non aprire un dialogo che non posso chiudere): il foglio è passato
   sotto **«GIÀ STAMPATI»** con «Ristampa» e «Segna non stampato», e il
   contatore è sceso a **3**.
9. **Aggiunto un piatto al 2° turno** e riaperta la Cucina: è comparso un
   foglio nuovo, **«2° turno · AGGIUNTA»**, con dentro **solo** il piatto
   nuovo — e il foglio già stampato è rimasto sotto coi suoi due.

⚠️ **Il punto 9 l'ho scritto da uno script, non col dito**: dopo un
ricaricamento della pagina il modo in cui comando il browser da qui ha smesso
di far rispondere il tocco sulla pianta — **anche su un tavolo libero**, che
è il caso che aveva funzionato dieci minuti prima. È un limite dello
strumento, non dell'app; ma il gesto «aggiungo un piatto a un turno già
stampato» **non l'ha fatto una mano**.

**Ripulito**: il conto di prova, le sue righe e i due biglietti sono stati
cancellati. Ricontrollato dopo, non promesso: **0 conti aperti, 0 biglietti,
0 righe orfane**, e i tre conti chiusi dello scenario `BASE-` intatti coi
loro sei piatti.

---

## 7 · I file

| file | cosa |
|---|---|
| `supabase/migrations/20260821000001_i_turni_dei_pasti.sql` | la colonna, il vincolo, `chiamate_turno` con la sua RLS e il rifiuto sui conti non aperti |
| `src/lib/calcoli/turni.js` | **la regola, pura**: etichetta, righe per turno, fogli della cucina |
| `src/lib/api/orders.js` | il turno viaggia con la riga; le tre funzioni dei biglietti |
| `src/pages/comande/Sala.jsx` | «Prossimo turno», le righe di stacco, «Avanti prossimo turno» |
| `src/pages/comande/Cucina.jsx` | i fogli per turno, l'AGGIUNTA, i biglietti nella stessa coda |
| `tests/unita/turni.test.js` · `tests/app/turni-dei-pasti.test.js` | 11 + 7 |

---

## 8 · Cosa serve da Alessio

1. **Il push**, e solo dopo posso applicare la migrazione in produzione — che
   aggiunge una colonna a `order_items` (predefinito 1, nessuna riga
   esistente cambia significato) e crea una tabella nuova.
2. **Guardare i tre fogli**: il turno nell'intestazione si legge? La parola
   **AGGIUNTA** si distingue abbastanza da non passare inosservata a chi ha
   le mani occupate?
3. **Dire se il Bar deve seguire**: oggi raggruppa ancora per invio, e non è
   una dimenticanza.
