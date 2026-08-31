# La pulizia delle cose certe — due copie che git conservava già

**31/08/2026** · ramo `ci/controlli-automatici`

**Commit di questa consegna**: `954bc84` — *«Via due copie che git conservava già»*.
Questo riepilogo è l'ultimo commit della consegna ed è **sola documentazione**.

**Nessuna migrazione. Nessuna riga di codice toccata.** Solo documenti e
`.gitignore`.

---

## 1 · Da dove nasce

Alessio ha chiesto di studiare il repository e trovare **file obsoleti o
contenuti dismessi ma ancora presenti**, con la domanda esplicita: *«a cosa
servono tutti i file che iniziano con `_` (es. `_collaudo*`)?»*

⚠️ **Quella prima domanda ha risposta zero, ed è la risposta utile**: in tutto
il repository e in tutta la storia dei commit **l'unico file che comincia per
`_` è `public/_redirects`**, che serve (è la riga che evita il 404 su
`/comande`). I `_collaudo…` che vede sono sul **suo computer**: sono gli script
usa-e-getta, tenuti fuori dal `.gitignore` con la regola allargata tre volte
(22/08 e due volte il 29/08, ogni volta perché uno era scappato dentro un
commit).

La misura è poi proseguita su tutto il repository. Quello che segue è **il solo
gruppo che Alessio ha autorizzato**, quello che avevo classificato «certo».

---

## 2 · Il quadro generale, perché conta più della pulizia

Prima di elencare cosa è stato tolto, cosa la misura ha trovato **sano** — ed è
la parte che dice quanto vale la pulizia (poco, ed è una buona notizia):

| controllo | esito |
|---|---|
| file di codice mai importati da nessuno | **zero** (solo `main.jsx`, che è l'ingresso) |
| componenti a schermo mai usati | **zero** |
| collegamenti relativi rotti nei documenti | **zero su 280 documenti** |
| migrazioni nel repository / in produzione | **367 / 367**, allineate |

**Non c'è codice morto sparso.** I 10 file tolti sono avanzi identificabili uno
per uno, per 124 KB: è pulizia d'ordine, non di peso.

---

## 3 · Cosa è stato tolto

### 3.1 · `docs/collaudo/copie/` — 4 file, tolti

Fotografie prese il **18/08 prima del giro A**: la sala di produzione, la sala
di prova, gli scostamenti di giornata, più una fotocopia di
`prova-ricostruisci.mjs`.

- **Nessun file del repository le nominava.** Misurato con un setaccio su
  `docs/`, `CLAUDE.md`, `scripts/`, `src/`, `tests/`, `supabase/`: zero
  citazioni per tutti e quattro.
- La fotocopia era ferma a **223 righe** contro le **416** dello script vivo:
  vecchia di due settimane, e git l'originale ce l'ha comunque.
- La rete che quelle fotografie facevano quella notte oggi è `npm run backup`.

🔴 **E UNA CONTENEVA UNA LEZIONE, che è stata controllata PRIMA di cancellare.**
`scostamenti-prova.sql` dichiara di sé stesso *«questa fotografia non ha
funzionato, e resta qui come lezione»*. La lezione è:

> **Una fotografia che conserva un identificativo non sopravvive a una
> ricostruzione: deve conservare il NOME.**

⚠️ **È scritta parola per parola in
[`20260818_giro_a_la_sala_non_si_perde.md`](20260818_giro_a_la_sala_non_si_perde.md),
paragrafo 4** — con in più il perché (la ricostruzione ricrea le sagome con
identificativi nuovi) e la forma giusta (`where label = …`). Si toglie
dichiarando dove la regola resta scritta, non cancellandola e basta.

### 3.2 · `docs/quesiti/da_portare/` — 6 file HTML, tolti dal repository e **non dal disco**

Sono i fogli da stampare per Laura, Gianna, Tiziana, le banche e l'ASP. Li
rigenera `npm run quesiti` da `docs/quesiti/QUESITI_CONSULENTI.md`.

✅ **DIMOSTRATO INVECE CHE DEDOTTO.** Su questo clone pulito i sei file sono
stati messi da parte, rigenerati col comando, e confrontati:
`diff -rq` risponde **zero differenze**. Sono la stampa, non la fonte.

🔴 **E LA REGOLA ESISTEVA GIÀ, APPLICATA AL CONTRARIO.** `docs/collaudo/documenti/`
è ignorato dal 17/08 con la ragione scritta accanto nel `.gitignore`: *«nel
repository sta il generatore, che è la fonte, non sei PDF binari da tenere
allineati a mano»*. Gli HTML dei quesiti erano **lo stesso identico caso,
trattato in modo opposto** — e nessuna consegna aveva mai dichiarato quella
scelta: ci sono finiti dentro, non ci sono stati messi.

⚠️ **Il rischio non era lo spazio**: è che modificando il documento dei quesiti
la stampa restasse indietro **senza che nessuno potesse vederlo**. Due posti che
dicono la stessa cosa e possono contraddirsi — il discriminante del 17/08
risponde *«direbbero esattamente la stessa cosa»*, quindi si toglie il doppione
invece di costruirgli un guardiano.

Aggiunta la riga a `.gitignore` col perché e con la misura accanto.

---

## 4 · Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa in precedenza viene ribaltata da questa
consegna, e la sezione c'è lo stesso perché un riquadro che compare solo nei
guai fa dubitare, quando manca, di non averlo visto.

⚠️ **Il caso più vicino a un rovesciamento non lo è, ed è stato controllato**:
gli HTML dei quesiti erano committati, e ora non lo sono più. Ma **nessuna
consegna aveva mai dichiarato quella scelta** — verificato cercando
`quesiti-stampabili` e `npm run quesiti` in tutti i riepiloghi e nei documenti
di `docs/`: zero risultati. Non si rovescia una decisione: si applica a un
posto una regola che esisteva già dal 17/08 e che lì non era mai arrivata.

Nessuna riga aggiunta a [`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## 5 · Cosa NON è stato toccato, e perché

Il resto della misura è stato **riportato ad Alessio e non eseguito**. Resta in
attesa di una sua decisione:

- **`supabase/functions/prova-ai/`** — il collaudo della catena AI dell'11/08,
  che ha risposto `FUNZIONA` e ha chiuso il blocco 5 del Mandato strutturale.
  Nessuna riga del gestionale la chiama, ed è ancora installata online.
- **`scripts/censimento-didascalie.mjs`** — l'unico file del repository che
  **nessun documento nomina** e che nessuno script importa.
- **`supabase/pulizia/20260812_pulizia_dati_prova.sql`** e **3 dei 6 file di
  `supabase/diagnostica/`** (le installazioni del 09/08). Gli altri tre — gli
  audit dell'08/08 — vanno tenuti: `CLAUDE.md` dice di rilanciarli.
- **`confermaAllergeni` e `confermaTutti`** in `src/lib/api/schedeProdotto.js` —
  🔴 **sono il resto del cancello che Alessio ha tolto il 25/08**, quando ha
  deciso che un allergene dedotto vale come confermato. La rimozione fu fatta
  nella vista del database e nella schermata, **non qui**: le due funzioni sono
  ancora nel codice e nessuno le chiama. È la famiglia della regola tolta da un
  posto su quattro.
- **27 funzioni esportate e mai collegate a una schermata** (caparre trattenute,
  sold out, scarichi senza ricavo, note di credito, rese delle preparazioni,
  tre regole di deducibilità su cinque…). ⚠️ **Non sono avanzi**: sono lavoro
  che nessuno può vedere, e vale la regola del 18/08 — *un dato scritto che
  nessuno può vedere è indistinguibile da un dato non scritto*. Il difetto lì è
  la schermata che manca, non la funzione di troppo.

---

## 6 · E una cosa che non è un file

🔴 **La «Carta di prova» del 21/08 è ancora nel gestionale VERO, e ancora
attiva.** Misurato in sola lettura sulla produzione: 1 menu e 14 ricette finte,
mentre ingredienti, fornitori, conti, prenotazioni, documenti e movimenti di
cassa sono **tutti a zero**. È l'ultimo pezzo di collaudo rimasto, e
`scripts/menu-di-prova.mjs` dice di sé stesso che *«va tolta prima dei dati
veri»*. I nomi sono plausibili apposta: il giorno che entrano ricette vere non
si distinguono a occhio.

**Non toccata**: sono righe di Alessio, e la decisione è sua.

---

## 7 · Cosa NON è verificato

- ⚠️ **Le 459 prove contro il progetto di prova non sono state lanciate da qui**:
  manca `.env.test`, che è git-ignored e su un clone pulito non esiste. **Le
  lancia la CI** sul push. Quello che è stato lanciato qui: lint pulito, **657
  prove pure su 657**, build verde.
- ⚠️ **Nessuna schermata è stata guardata**, e non serviva: la consegna non
  tocca nessun file di `src/`.
- ⚠️ **Il setaccio delle 27 funzioni mai collegate dice DOVE guardare, non cosa
  è vero** (lezione del 22/08): conta dove un nome compare, quindi prima di
  togliere una di quelle righe va aperta e letta. Per questo non ne è stata
  tolta nessuna.
- ✅ **I collegamenti fra documenti sono stati ricontrollati DOPO la pulizia**,
  allargando il controllo anche ai file `.html`: **zero target mancanti**. E
  nessun file cita più i quattro tolti da `copie/`.
