# Le tabelle che nessuno aveva classificato

**Blocco 5 del mandato del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `4193fdc` |
| migrazione introdotta | `20260829000021_le_undici_che_nessuno_aveva_classificato.sql` |
| applicata in produzione | **NO** — il push non è stato fatto |
| applicata sul progetto di prova | sì, e rotta due volte |

---

## 5b — LA PREMESSA NON REGGE, ed è già chiuso

Il mandato dice, marcandolo **MISURATO in produzione**: *«`varianti_ingrediente`:
il commento promette "marca, formato" che la funzione non restituisce… è
falso da giorni. O aggiungi le colonne o correggi il commento.»*

**Rimisurato in produzione E sul progetto di prova**, e la premessa non
regge — è già stato chiuso il **27/08**, dalla migrazione
`20260827000022_marca_e_formato_arrivano_nell_elenco`:

```
varianti_ingrediente restituisce:
  articolo_id, descrizione, MARCA, FORMATO, nome_esteso, fornitore, …
```

E il commento della funzione lo dice: *«Marca e formato sono arrivati il
27/08/2026, quando le colonne sono nate.»* La schermata li mostra
(`IngredienteForm.jsx`, righe 530-537), e il commento sopra la tabella —
quello che era la promessa non mantenuta — adesso è vero.

⚠️ **Non ho toccato niente**, ed è la cosa giusta: cambiare un commento
già vero è un modo per farlo diventare falso.

---

## 5a — le tabelle non classificate

### 🔴 NON ERANO UNDICI: SONO SEDICI

Il mandato ne nomina **undici** — quelle con la classificazione **vuota**.
Misurato con `perimetro_da_sistemare()`, ce ne sono altre **cinque che nel
catalogo non compaiono affatto**, nate dopo l'ultimo censimento:

| tabella | quando è nata |
|---|---|
| `cataloghi_vocabolario`, `categorie_ingrediente` | 27/08 |
| `settimana_cucina` | **ieri**, col calendario della cucina |
| `preparazioni_da_fare`, `preparazioni_ricorrenti` | **stanotte**, con questo stesso mandato |

⚠️ **Le ultime due sono mie**, e classificarle è parte del lavoro: ieri una
sessione ha lasciato `settimana_cucina` fuori dal catalogo, e stanotte
avrei fatto lo stesso senza guardare. **La rete se n'era accorta** — è
`perimetro_da_sistemare()` che le nomina. Il buco non era nel controllo:
era in chi non lo interrogava.

### 🔴 E UNA MISURA HA CAMBIATO LA PROPOSTA

`order_tables` sembrava dover entrare per forza: `orders` è dentro dal
26/08, e la ragione già scritta dice «sta o cade con `orders`».

**Ma `order_tables` non ha una colonna `id`** — guardato, non dedotto. È
esattamente l'ostacolo che tiene fuori le caparre: la lapide nascerebbe
**senza riferimento**, e una lapide senza `record_id` è la cosa che il
controllo del perimetro respinge. Quindi resta **da decidere**, e il
prerequisito è tecnico prima che di merito: serve una chiave primaria.

### La proposta

Il criterio non è toccato, ed è quello che Alessio ha precisato il 26/08:
**ci sta ciò la cui cancellazione lascerebbe un buco che qualcuno un
giorno dovrà spiegare a un terzo** — un controllore, un consulente, un
cliente.

**DENTRO (5)** — ognuna col trigger attaccato:

| tabella | in una riga |
|---|---|
| `preventivi` | il documento che dice cosa è stato promesso a un cliente, e il terzo che un giorno lo chiederà è il cliente |
| `preventivo_fogli` | il foglio che il cliente ha in mano, fotografato al momento |
| `preventivo_righe` | senza le righe la testata dichiara un totale che nessuno può ricontrollare |
| `scadenze_previste` | le scrive lui a mano: cancellarne una fa sparire un pagamento dovuto in silenzio |
| `storico_costi_ricetta` | l'unica cosa che non si ricostruisce a posteriori — i prezzi di oggi non dicono quanto costava quel piatto a marzo |

**FUORI (8)**:

| tabella | in una riga |
|---|---|
| `dettature` | non è il documento di un fatto del locale: è il **contatore di spesa** di uno strumento, e la spesa si sorveglia col tetto |
| `azioni_dettate` | fuori con `dettature`; ciò che un'azione ha *prodotto* è già tracciato per conto suo dall'08/08 |
| `letture_foto` | fuori con `dettature`; la foto non viene mai salvata, qui c'è solo quanto è costata |
| `cataloghi_vocabolario` | configurazione, non un fatto |
| `categorie_ingrediente` | configurazione; una spenta resta legale per chi la porta |
| `settimana_cucina` | sette righe fisse: non si cancella, si cambia |
| `preparazioni_da_fare` | un promemoria che si toglie con un tocco per costruzione |
| `preparazioni_ricorrenti` | un'impostazione, come `settimana_cucina` |

⚠️ **Su `dettature` l'argomento contrario è scritto accanto alla riga**, e
non è debole: cancellandone una la spesa del mese cala, quindi quel numero
non è più ricontrollabile. È scritto perché la riga possa essere rovesciata
leggendo, senza rifare l'indagine.

**RESTANO DA DECIDERE (3)**: `price_history` e `reservation_deposits` —
che il mandato dice espressamente di non decidere da qui — più
`order_tables`, fermata dalla misura.

⚠️ **Vuoto e «fuori» sono due stati diversi**, e il controllo li distingue:
una decisa fuori sparisce dall'elenco, una vuota **resta lì a chiedere**.

---

## Cosa abbiamo rovesciato

**Niente.** La sezione *Registro delle cancellazioni — il perimetro* di
`docs/DECISIONI.md` è stata **letta e non contraddetta**: il criterio
dell'08/08 e le decisioni del 26/08 restano intere, e questa migrazione
riempie solo le caselle che quel giorno erano state lasciate aperte —
compresa la riga che diceva *«le tabelle non ancora classificate si
segnalano e basta: Alessio le guarda una per una più avanti»*.

⚠️ **Quella riga è la ragione per cui questa è una PROPOSTA e non una
decisione**: il file si legge tutto in una volta, ogni riga porta la sua
ragione, e cambiarne una vuol dire cambiare `dentro` e riscrivere la
frase.

Nessuna decisione nuova aggiunta a `docs/DECISIONI.md`: qui non ce n'erano
da prendere, e le tre che restano sono nelle domande.

---

## Come è stato provato

La verifica ha quattro controlli, e i due primi sono **proprietà** e non
conteggi travestiti: nessuna tabella fuori dal catalogo, e le da decidere
sono esattamente le tre **nominate**.

**Rotta tre volte, e la terza è quella che serviva:**

| rottura | dove fallisce |
|---|---|
| tolto il trigger da una che entra | controllo (1) — *«ci sono ancora 1 tabelle fuori dal catalogo»* |
| messo un trigger su una decisa FUORI | controllo (1) — **lo stesso** |
| la lapide nasce **senza riferimento** | controllo (3) — *«non porta il riferimento giusto (NULL invece di 488f9bd2…)»* |

🔴 **E le prime due cadevano sullo stesso controllo**, che è precisamente
quello che la regola vieta di accettare: due rotture che falliscono nello
stesso punto dimostrano che *un* guardiano funziona, non che la verifica
discrimina. Il primo controllo si è rivelato più forte di quanto pensassi —
`perimetro_da_sistemare()` sorveglia già la coerenza fra classificazione e
trigger — e per arrivare ai controlli sotto è servita una rottura che lo
attraversa: **la lapide senza riferimento**, che è la stessa tecnica del
26/08.

⚠️ **E la lapide creata dalla verifica si toglie**: il registro è
esibibile, e righe finte lì dentro rompono il guardiano che ogni
migrazione usa per difendersi (lezione del 19/08).

⚠️ **La migrazione si è fermata due volte su colonne indovinate** —
`scadenze_previste.data_prevista` (è `scade_il`, e `entity_id` è
obbligatoria) e `deleted_records.record_id` che è **testo e non uuid**.
Guardarle costava dieci secondi.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* **Nessuna schermata**: questo blocco non ne tocca nessuna.
* **Non ho cancellato un preventivo vero** per vedere la lapide: il
  controllo passa da `scadenze_previste`, che è la più innocua delle
  cinque. Le altre quattro hanno il trigger attaccato dalla stessa riga di
  codice, ma non sono state esercitate una per una.
* **Il commento di `varianti_ingrediente` l'ho letto**, non l'ho visto a
  schermo — la tabella delle versioni ha bisogno di un ingrediente con più
  di una versione comprata, e sul progetto di prova non ne ho cercato uno.

**Cosa ho contato senza leggerlo**
* «sedici tabelle», «cinque non classificate», «tre da decidere» vengono
  da `perimetro_da_decidere()` e `perimetro_da_sistemare()`.
* «`order_tables` non ha `id`» è un conteggio su
  `information_schema.columns` — e quello l'ho letto.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* Avevo proposto `order_tables` **dentro**, ragionando che stesse o cadesse
  con `orders`. **Falsa**: guardando le colonne, la lapide nascerebbe senza
  riferimento.
* Avevo scritto, progettando, che due rotture sarebbero bastate. **Falsa**:
  cadevano sullo stesso controllo, e ne è servita una terza.

**Quali blocchi non ho aperto**
* Nessuno: 1, 2, 3, 4 e 5 sono tutti aperti e chiusi. Quello che resta
  fuori è dichiarato nelle domande — la funzione online della voce non
  installata, e le tre tabelle da decidere.

**Quali conteggi sono pavimenti**
* «sedici» è quello che il catalogo dice **oggi**: una tabella nuova domani
  ricomparirebbe fra le non classificate, ed è quello che deve fare.

**Cosa ho lasciato sul progetto di prova**
* **Niente**: `scadenze_previste` con nome `VERIFICA%` **0**, lapidi finte
  **0**, `preparazioni_ricorrenti` **0**, trigger sulle tabelle decise
  fuori **0**, e `log_deleted_record` è tornata sana.
* I due documenti vuoti che Alessio tiene apposta **non sono stati
  toccati**.
