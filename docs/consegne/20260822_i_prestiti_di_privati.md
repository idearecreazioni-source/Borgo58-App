# I prestiti di privati

**Mandato del 22/08** ([`docs/mandati/20260822_i_prestiti_di_privati.md`](../mandati/20260822_i_prestiti_di_privati.md)).
**Migrazione `20260822000005`** — ⚠️ **solo sul progetto di prova**.
Corridoio **v31**, schermata `/cassa/prestiti`.

---

## 1 · Le tre misure chieste prima di costruire

Il mandato chiedeva di misurare tre cose e riferire **prima** di scegliere.

### a) Le causali: nessuna serviva, e una somigliava

| trovato | e perché non bastava |
|---|---|
| `cash_movements.is_owner_injection` | esiste già, ma vuol dire **soldi di Alessio**: usarlo direbbe che i 20.000 di Ylenia sono suoi, cioè l'opposto |
| `anticipazioni_socio` | è il **verso contrario** — Alessio che paga di tasca propria per la società |
| le 17 causali | 12 sue e 5 di sistema; nessuna riguarda un debito |

**Quindi**: un prestito **non è** una causale nuova. È un **fatto suo**, con
una sua tabella, che *produce* un movimento di cassa marcato.

⚠️ **La causale serve lo stesso**, ed è il motivo per cui il modulo si spegne
senza: il movimento in prima nota deve avere una voce come tutti gli altri.

### b) «Ce la faccio?» era già il conto giusto

`previsione_cassa(p_entity_id, p_fino_al)` **prende già l'orizzonte come
parametro**: non ne è stato scritto un secondo. `spazio_di_manovra()` la
chiama a **sei mesi** e ne toglie la riserva di 5.000.

⚠️ Ne eredita anche i limiti, **e li ripete**: non comprende gli stipendi, la
carta è al lordo delle commissioni.

### c) 🔴 La cosa da verificare per prima: la Proiezione è salva, il saldo no

| | esito |
|---|---|
| **Proiezione e imposte** | ✅ **già al sicuro, senza toccare niente**: dal 15/08 i ricavi si leggono **solo dai conti chiusi**, e un prestito non sta su nessun conto |
| **Saldo di cassa** | 🔴 **li contava come incassi** — la schermata Cassa scompone il saldo in «fondo + **incassi** meno uscite», e `declared_takings` prendeva tutte le entrate |

**Il saldo deve contarli** (i 4.990 sono contanti veri nel cassetto: fuori dal
saldo, il primo conteggio darebbe un'eccedenza e una rettifica per un errore
che non esiste — lezione delle mance del 16/08). **Cambia solo come si
chiamano**: `declared_takings` esclude ciò che porta un `prestito_id`, e
compare `prestiti_in_cassa`.

⚠️ **La colonna nuova è IN FONDO**, perché una vista si può solo allungare
(`42P16`), e la vista è stata presa dal database — non dal file che l'aveva
creata.

---

## 2 · Le due domande, separate

> «quanti soldi ho?» → il saldo, invariato · «quanti soldi sono **miei**?» → il saldo meno i prestiti in cassa

In Cassa la scomposizione ha una riga in più: `+ … di prestiti da restituire`.

E in `/cassa/prestiti` il numero grande è **quello che si può restituire
adesso**, col debito in piccolo accanto — l'ordine chiesto da Alessio:
*sapere di dovere 30.000 non serve a decidere niente.*

## 🔴 Nessuna scadenza, e non è un'omissione

`prestiti_privati` **non ha una colonna scadenza**. Non è «non l'abbiamo
messa»: metterla vorrebbe dire che prima o poi qualcosa la leggerà e
chiederà. Nessun promemoria, nessun piano, nessun avviso.

⚠️ **E il perché dei 4.990 non è scritto da nessuna parte**, per decisione di
Alessio. L'importo è quello.

---

## 3 · Quattro difetti trovati, e tre erano miei

### 🔴 a) `prestiti_aperti` filtrava invece di rifiutare

La rete dei permessi è diventata rossa da sola: **18 funzioni scoperte invece
di 17**. La funzione aveva `and (select is_titolare())` dentro il `where` — lo
staff otteneva **un elenco vuoto**, cioè *«non hai preso soldi da nessuno»*.

⚠️ **Non era una fuga di dati** (misurato: lo staff vedeva vuoto davvero), ed
è precisamente ciò che la rende insidiosa: **filtrare somiglia a proteggere**.
È la forma respinta il 13/08 su otto funzioni — *chi non deve vedere riceve un
rifiuto, non un elenco vuoto*.

⚠️ **E la rete aveva ragione per il motivo giusto**: cerca il **gesto** «se non
sei il titolare, rifiuta», e un filtro non è quel gesto. Ora è `plpgsql` con
`raise exception`, e la prova controlla **il rifiuto insieme al fatto che il
titolare li veda** — su una tabella vuota nessuna delle due cose
significherebbe niente.

### 🔴 b) Sette lapidi finte nel registro delle cancellazioni

Le verifiche cancellavano i propri movimenti di prova, e `trg_log_delete` ne
conservava la copia in un registro **esibibile che nessuno può ripulire
dall'app**. È il difetto del 19/08, ricomparso.

⚠️ **L'ha preso la prova nata allora** (`registri-esibibili`), che chiede al
database invece di leggere le righe. *Una trappola scritta non è una trappola
chiusa — ma una trappola sorvegliata sì.*

Ora le due pulizie spengono il guardiano e **controllano al catalogo di averlo
riacceso**.

### 🔴 c) «5000 euro» dentro un gestionale che scrive «5.000,00 €»

Avevo composto l'avvertenza concatenando il numero a mano.

⚠️ **E la rete del 17/08 non se ne sarebbe accorta**: cerca le maschere
`to_char`, non un importo concatenato. *Una regola sorvegliata in una sola
delle sue forme si aggira senza volerlo.*

### 🔴 d) Un difetto che non è mio, ed è in tutte le schermate

Guardando i prestiti: **«4990,00 €» a schermo e «4.990,00 €» nei messaggi del
database**, lo stesso importo.

⚠️ Misurato: `Intl` in italiano **non raggruppa sotto le cinque cifre**. Quindi
la divergenza vive esattamente nella fascia dei numeri a **quattro cifre** —
prestiti, stipendi, fatture grosse — ed è il motivo per cui non si era mai
vista: quasi tutti gli importi di prova stanno sotto i 1.000 o sopra i 10.000.

Allineato al database (`useGrouping: "always"`). ⚠️ **Tocca tutte le
schermate**: è una riga in `formatEUR`, e se Alessio preferisce l'altro verso
si cambia in un punto solo.

---

## 4 · Cinque prove esistenti erano rosse, e avevano ragione i vincoli

Eseguendo la suite intera — cosa che non era stata fatta dopo i blocchi
precedenti — **cinque prove erano rosse**, tutte per migrazioni di ieri.

| prova | perché | chi aveva ragione |
|---|---|---|
| `tesoreria` (3) | costruiva un conto **già chiuso** e poi ci metteva le righe: il vincolo del 22/08 lo respinge | **il vincolo**. La prova non provava quel gesto, lo *apparecchiava* — ma in un ordine che una sala non consente. Ora apre, serve, chiude |
| `elenco-che-si-fa-notare` (2) | segnalava lo scontrino **dallo staff** | **la decisione di Alessio**. Il commento diceva *«se girasse col titolare non starebbe provando il gesto vero»*: era vero fino al 22/08 |

⚠️ **Il rovesciamento era già registrato** ([le decisioni
rovesciate](../decisioni_rovesciate.md)): a restare indietro era solo la
prova. *Una decisione rovesciata e scritta non basta — le prove che la
contraddicono restano verdi finché nessuno le riesegue.*

E la prova aggiornata ora contiene **la controprova che prima non c'era**: lo
staff riceve il rifiuto **e il conto resta intatto**.

---

## 5 · Cosa è stato rotto apposta

| rottura | esito |
|---|---|
| tolta l'esclusione dei prestiti da `declared_takings` | 🔴 rossa: **300 → 5.290**, il prestito contato come incasso. È l'asserzione che protegge la Proiezione |
| tolto il portiere da `segnala_scontrino_non_uscito` | 🔴 rossa la controprova nuova |

⚠️ **E due volte la rottura non era avvenuta** — `psql` non trovato, testo non
combaciante — e in tutti e due i casi le prove restavano **verdi**. *Un verde
dopo una rottura che non è andata a segno non dice niente*, ed è la ragione
per cui si verifica che la rottura ci sia stata prima di leggere il risultato.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **In produzione non è entrato niente.** La migrazione è solo sulla prova.
2. 🔴 **I tre prestiti veri non sono registrati**: li registra Alessio, sono
   fatti suoi. Quelli guardati a schermo erano marcati `__PROVA__` e sono stati
   tolti (saldo tornato a **-2391**, incassi **300**, zero movimenti orfani).
3. ⚠️ **Nessuna mano ha registrato un prestito da schermo**: la schermata è
   stata aperta e guardata, i gesti passano dalle prove automatiche.
4. ⚠️ **Lo spazio di manovra non è mai stato letto con dati veri**: oggi la
   previsione a sei mesi sta a 2.197,86 su un locale che non ha aperto.
5. ⚠️ **La riserva di 5.000 è scritta nel codice**, non è un campo suo. Se
   vorrà cambiarla serve una migrazione.

---

## Cosa abbiamo rovesciato

**Una cosa, e non era una decisione di prodotto**: la prova della tesoreria
apparecchiava conti chiusi scrivendo le righe dopo, ed era **il modo normale
di questo progetto** fino a ieri. Ora non si può più, e la ragione di allora
(«è solo apparecchiare, non un gesto vero») **non vale più** — perché un
apparecchiamento che la realtà non consente costruisce uno stato che in sala
non può esistere.

⚠️ **E una cosa che NON è stata rovesciata**: `is_owner_injection` continua a
voler dire «soldi di Alessio». I prestiti gli stanno accanto senza toccarlo, e
i due numeri restano separati in Cassa — *perché sono due fatti diversi, e il
mandato nasce proprio dal non poterli distinguere.*
