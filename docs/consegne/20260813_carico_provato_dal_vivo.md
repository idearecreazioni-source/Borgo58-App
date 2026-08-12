# Consegna del 12-13/08/2026 — il carico da fattura, provato fino in fondo

**Commit della consegna: `81ba0ed`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

Copre tutto ciò che è successo dopo `20260812_prova_dettatura.md`: due
difetti seri trovati **da Alessio mentre provava**, entrambi chiusi, e la
verifica end-to-end del modulo su tre documenti con conferme vere.

Migrazioni applicate in produzione da me: `20260812000018`. Funzione
`posta-leggi` reinstallata due volte.

---

## 1. I due difetti, e sono della stessa famiglia

### «Non ho capito come faccio a collegare i prodotti»

Gli avevo risposto: *scegli l'ingrediente dal menu*. Lui: *«non trovo
nulla di ciò che hai detto»*.

**Il menu era vuoto.** La lista degli ingredienti si caricava una volta
sola all'apertura della pagina; Alessio l'aveva aperta col Ricettario
vuoto, poi aveva confermato il primo carico — e i sette ingredienti erano
nati **dopo**. Il menu teneva ancora in mano la lista di prima.

Non sembrava un guasto: sembrava un menu che non serve a niente. E la mia
risposta lo ha mandato a cercare per dieci minuti una cosa che non c'era.

### «Ho due olio extravergine d'oliva»

Questo è il peggiore della giornata, e l'ho trovato solo guardando **cosa
era stato eseguito** invece di cosa sembrava:

> `ricarica()` ricostruiva i valori dal database. Confermare **una**
> proposta di una mail azzerava le modifiche non ancora confermate su
> **tutte le altre proposte della stessa mail**.

Alessio aveva collegato olio e semola agli ingredienti che aveva già, poi
ha confermato l'archiviazione del documento — e i due collegamenti sono
spariti in silenzio. Ha confermato il carico convinto di averli fatti, e
si è ritrovato due ingredienti doppi.

**Nessun errore, nessun avviso: lavoro perso e un dato sbagliato che
sembra giusto.** Erano tre righe di codice.

**Due difese, non una.** Corretto in schermata (le modifiche in corso si
conservano) e nel database: `trova_o_crea_ingrediente()` si aggancia a un
ingrediente con lo stesso nome — a meno di maiuscole, punteggiatura e
spazi — invece di crearne un altro. Non un vincolo di unicità sulla
tabella, perché due entità fiscali possono legittimamente avere lo stesso
ingrediente. Agganciandosi **non riscrive** unità e categoria di quello
esistente: chi c'era prima l'ha deciso Alessio, e una riga di fattura non
ha titolo per cambiarlo.

E un terzo pezzo, che è quello che gli avrebbe fatto risparmiare la
domanda: se una riga assomiglia a un ingrediente già in anagrafica, ora
**lo dice lui** — *«Assomiglia a Olio extravergine di oliva che hai già —
è la stessa cosa»*, un tocco. Il gestionale lo sapeva e taceva.

---

## 2. La verifica end-to-end, su tre documenti e con conferme vere

Rifatta da zero dopo la pulizia, nell'ordine che aveva rotto le cose.

| | |
|---|---|
| **Documento 1** (DDT, 9 righe) | 7 prodotti nuovi proposti col nome da cuoco, trasporto e CONAI già fuori. Confermato → **7 ingredienti, 9 diciture, 7 lotti, 7 prezzi, zero doppioni** |
| **Documento 2** (fattura, 8 righe) | **5 righe riconosciute da sole**; olio (formato nuovo) e semola (dicitura girata) collegati a mano col suggerimento; mandorle create. Confermato **dopo** l'archiviazione — cioè nell'ordine che prima cancellava tutto |
| **Documento 3** (fattura, 5 righe) | **zero righe da decidere**: tutte riconosciute, trasporto compreso |

**Conversioni**: 2 casse → 12 kg a 3,20; 2 lattine → 10 l a 9,80; 1 sacco
→ 25 kg a 1,15. Quadratura dei totali al centesimo su tutti e tre i
documenti (237,00 · 279,80 · 248,80).

**E la cosa che Alessio chiedeva da ieri sera**, verificata in schermata:

> **Olio extravergine di oliva** — un ingrediente solo
> · lattina 5 L → **9,80 €/l** ↓
> · bottiglia da 1 L → **12,00 €/l**

Un ingrediente, le sue versioni dentro, la più conveniente per prima.

**Gli avvisi**: rincaro sui pomodori (+12,5%) arrivato in schermata **e su
Telegram**; olio in formato nuovo trattato come *versione nuova* e **non**
come rincaro; ricotta a prezzo uguale e basilico in calo: muti.

---

## 3. Cosa resta non verificato, e lo dico chiaro

- **Il documento 3 non è ancora stato confermato** al momento in cui
  scrivo. È quello che deve produrre l'avviso **coi due numeri** — «+8,3%
  sull'ultima volta, +21,9% da quando lo compri» — che è l'unica cosa
  costruita e mai vista dal vivo.
- **Nessuna fattura vera di un fornitore vero** è mai passata di qui: i
  tre documenti sono di collaudo, generati apposta e marcati come tali.
- **I dati delle prove sono ancora in produzione** mentre scrivo (8
  ingredienti, 12 diciture, 13 lotti): vanno cancellati subito dopo
  l'ultima conferma, come è già stato fatto due volte oggi.

---

## 4. La dettatura in cucina — prova fatta, esito misurato

Chiesta da Alessio prima di comprare hardware. Tre dettature di frasi da
ricetta vere, l'ultima **con la musica accesa**:

- **tutti i numeri corretti**, sempre: 100 g, 50 g, 3 uova, 20 grammi,
  60 °C, tre volte, 10 minuti;
- **errori solo sulle parole**, e sempre di tipo culinario: *boule* →
  «bolla», *liscia e setosa* → «Alice setosa», *un grado* → «uno», *la
  pasta in* → «la passera», *il basilico* → «il pericolo».

Due conseguenze:

1. **Sbaglia nel modo giusto.** Un numero sbagliato non si nota, una
   parola sbagliata sì — e il disegno (prima il testo scritto, poi
   l'interpretazione) è fatto apposta perché quegli errori si vedano
   prima di diventare modifiche a una ricetta. In più l'interpretazione
   raddrizza da sé «il pericolo dentro» in un contesto di pomodoro.
2. **La percentuale di sicurezza non vuol dire niente**: quelle frasi
   avevano 94-97%.

Alessio: *«più che accettabile, considerato che poi avremo il microfono
sotto la bocca e la musica che si stacca mentre parlo»*. Concordo:
**l'hardware si può comprare.**

La schermata `/prova-voce` è **usa-e-getta** e va cancellata dopo la
decisione. Ha avuto anche lei il suo difetto istruttivo: apriva il
microfono due volte insieme (riconoscimento + barra del rumore), Chrome
non lo permette, e io nascondevo l'errore `aborted` trattandolo come un
silenzio. Risultato: una pagina che «non fa niente» dentro lo strumento
che serviva a trovare i guasti silenziosi.

---

## 5. Decisioni di Alessio da mettere a verbale

- **Il food cost segue l'ultimo prezzo pagato.** Gliene ho posto la
  conseguenza coi suoi dati — sei bottiglie da 1 L a 12,00 fanno costare
  l'olio 12,00/l a tutte le ricette, anche con dieci litri in cella
  comprati a 9,80 — e ha confermato. Le alternative (media di quel che
  c'è in magazzino, prezzo della versione abituale) restano sul tavolo
  per quando ci saranno ricette vere.
- **Tre lavori nuovi in coda** (`CLAUDE.md` §10): campi dell'ingrediente
  proposti dall'assistente, percentuale di scarto proposta, pasti del
  personale come «comanda che non incassa».
  - Sugli **allergeni** ho posto un vincolo che non è formale: restano
    «da confermare» e non valgono per la stampa del menu finché non li
    guarda lui. Il rischio non è il modello: è che sui **prodotti
    lavorati** l'allergene sta nell'etichetta e non nel nome.
  - Sui **pasti del personale**, il trattamento fiscale non lo decide
    Code: si incrocia con gli omaggi sistematici (TD27) già in sospeso
    con Laura.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova | migrazione applicata due volte: idempotente |
| «stesso nome → stesso ingrediente» | **provato**, e provato anche che non riscrive unità e categoria dell'esistente |
| **produzione** | 72 migrazioni; `posta-leggi` reinstallata |
| carico end-to-end su 3 documenti | **provato dal vivo con conferme vere** |
| un ingrediente con dentro le sue versioni | **visto in schermata** |
| rincaro sulla versione giusta, in schermata e su Telegram | **visto** |
| formato nuovo non scambiato per rincaro | **visto** |
| prove automatiche | **29 verdi** |
| lint, build | puliti |
| **avviso coi due numeri** | visto **in schermata**, mai su Telegram — vedi §7 |
| **pulizia dei dati di prova** | **non fatta**: Alessio ha chiesto di lasciarli per ora |

---

## 7. 🔴 Difetto trovato all'ultimo controllo: il freno zittisce rincari veri

Confermato il documento 3, Alessio ha visto **due avvisi in schermata**.
Andando a verificare quali fossero davvero partiti, in `allarmi` ce ne
sono due — ma non quelli che sembrava:

- olio, **+10%**, dal documento 3 ✓
- pomodori, **+12,5%**, dal documento **2**

**Il rincaro dei pomodori del documento 3 — quello coi due numeri, +8,3%
sull'ultima volta e +21,9% dall'inizio — non è mai stato inviato.**

Causa: `segnala_allarme()` ha il freno anti-tempesta a **un avviso per
tipo all'ora**, e il tipo è `rincaro_<ingrediente>`. Le due conferme
distavano venti minuti.

In schermata i due avvisi c'erano, perché lì il confronto è calcolato dal
vivo e non passa dal freno. **Quindi lo schermo e Telegram dicevano due
cose diverse**, ed è il caso peggiore: chi guarda il telefono crede di
sapere tutto.

**Il freno è giusto per un guasto che si ripete**, dove il secondo
messaggio non aggiunge informazione. **Un rincaro è un fatto nuovo ogni
volta.** Correzione proposta e messa in coda (`CLAUDE.md` §10): il prezzo
entra nel tipo dell'avviso, così lo stesso rincaro non si ripete e uno
diverso passa.

Nella vita vera due fatture dello stesso prodotto a venti minuti non
capitano — ma un rincaro perso in silenzio è **esattamente** ciò che
questo modulo esiste per evitare, e il difetto va chiuso prima che
arrivino fatture vere.
