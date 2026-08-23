# L'unità non si cambia di nascosto

**23/08/2026 — Blocco 1** del mandato «l'unità in grammi, l'avviso sul
prodotto fermo, e due schermate».

🔴 **Va prima del blocco 2, e l'ordine non è una preferenza.** Il difetto
chiuso qui esiste già oggi; il grammo, senza questa migrazione, lo
moltiplicherebbe per mille.

| | |
|---|---|
| migrazione | `20260823000011_l_unita_non_si_cambia_di_nascosto.sql` |
| applicata | ✅ progetto di prova — ❌ **non** in produzione |
| prove nuove | `tests/app/cambio-unita.test.js` — 5, tutte verdi |
| app | **nessuna riga toccata**: il messaggio arrivava già intero |

---

## Il difetto, misurato

Cambiare l'unità di un prodotto non era sorvegliato da niente. I lotti non
hanno un'unità propria: la leggono dall'ingrediente. Quindi **993,3333 g
diventavano 993,3333 kg**, senza errore e senza che nessun numero cambiasse.

⚠️ Non lo introduceva l'unità piccola: valeva già fra kg e litri.

---

## 🔴 La misura che ha deciso la forma: la conversione PERDE NUMERI

Il mandato chiedeva quale strada scegliere fra tre. La risposta è venuta da
una misura fatta sui dati veri, **nei due versi**, non da un ragionamento.

**Da kg a g, sul prezzo** — che si *divide* per mille, dentro `numeric(12,4)`:

| prodotto | €/kg | €/g scritto | ritorno | errore |
|---|---|---|---|---|
| Sale | 0,6500 | 0,0007 | 0,7000 | **7,69 %** |
| Zucchero semolato | 1,1500 | 0,0012 | 1,2000 | 4,35 % |
| Carota | 1,2500 | 0,0013 | 1,3000 | 4,00 % |

**Da g a kg, sulle quantità** — che si dividono:

- righe di ricetta che diventerebbero **zero**: **95 su 317** (30 %)
- lotti che perderebbero **tutta** la giacenza: **15**

⚠️ **Quindi «converti sempre» non è una cura**: è lo stesso difetto con
un'altra faccia — numeri cambiati in silenzio, per arrotondamento invece
che per distrazione.

---

## Le tre strade, e perché due sono state scartate

**A. I lotti prendono un'unità propria.** Scartata, e non per la taglia:
apre un problema che oggi non esiste. Un prodotto con lotti in kg e lotti
in g avrebbe una **giacenza non sommabile**, e fra kg e pz non esiste
nessun fattore che li faccia sommare. Si guadagna la storia esatta e si
perde la domanda più semplice: *quanto ce n'è?*

**B. Si blocca e basta.** Scartata **da sola**: è un rifiuto senza via
d'uscita, cioè il difetto n. 8 del mandato di correzione. Chi ha creato lo
zafferano in kg resterebbe senza nessuna strada che non sia rifare il
prodotto da capo, **spezzando lo storico dei prezzi** — che è il numero su
cui si decide se un fornitore sta aumentando.

**C. Si converte.** Scartata da sola per la misura qui sopra.

### La cura: la regola del 16/08, applicata qui

> *«O è respinto con un messaggio che dice cosa lo impedisce e cosa fare
> prima, oppure storna l'effetto nella stessa transazione. Non esiste il
> terzo caso.»*

Il terzo caso **esisteva** ed era il difetto: l'unità cambia e i numeri
restano. Quindi:

1. **niente attaccato** → si cambia e basta (nessun numero da salvare, e
   vietarlo sarebbe una regola scritta sulle sue cose);
2. **conversione definita ed esatta su ogni riga** → si converte tutto,
   nella stessa transazione;
3. **conversione assente, o che perderebbe anche un solo numero** → si
   **rifiuta**, nominando il numero che si perderebbe.

🔴 **Il criterio è «non serve arrotondare», non «l'errore è piccolo».** Non
c'è nessuna soglia di tolleranza da scegliere — quindi non c'è nessun
numero che fra sei mesi qualcuno alzerà «solo un po'».

⚠️ **Nessuna scappatoia nel trigger** — né un parametro di sessione né una
funzione privilegiata che lo salta. È la lezione del congelamento delle
previsioni: *una scappatoia sarebbe anche la strada per aggirarlo*. Vale
per l'app, per il corridoio, per chi scrive dal browser e per una
migrazione futura.

---

## Cosa conosce oggi, e perché è giusto che sia poco

`unita_conversione()` parla per **testo**, non per valori dell'enum: così
regge sia prima che dopo il grammo. **Oggi nessuna coppia dell'enum è
convertibile**, quindi il comportamento è *si rifiuta sempre, se c'è
qualcosa attaccato* — il comportamento sicuro. Il blocco 2 aprirà il
grammo **dentro** questa protezione, senza toccarla.

---

## Le colonne: 24 classificate, chieste al catalogo

Trovate interrogando il catalogo (`ingredient_id` + colonne numeriche),
non ricordate: **12 tabelle**. Divise per come si comportano:

| | |
|---|---|
| **quantità** (17) | si moltiplicano per il fattore |
| **prezzo per unità** (5) | si **dividono** — se il kg vale 2400 €, il grammo ne vale 2,40 |
| **fattore d'acquisto** (1) | si moltiplica: una cassa da 6 kg è una cassa da 6000 g |
| **euro totali, percentuali, dosi** | non si toccano: un costo già sostenuto è quello, comunque lo si misuri |

⚠️ **L'elenco è esplicito, non costruito dal catalogo**, ed è una scelta:
dal catalogo entrerebbero anche i costi in euro. Il prezzo è che una
colonna nuova non ci finisce da sola — ed è per questo che accanto c'è
`colonne_unita_non_classificate()`, che **diventa rossa da sola** quando
compare una colonna numerica nuova legata a un ingrediente. Provata
aggiungendone una finta: l'ha vista.

---

## 🔴 Due difetti trovati costruendo, non rileggendo

**1. Il messaggio di rifiuto NOMINA UN PREZZO D'ACQUISTO.** Senza portiere,
chiunque avesse l'accesso della sala avrebbe potuto chiedere quanto costa
un prodotto provando a cambiargli unità — **il difetto chiuso il 13/08 su
`varianti_ingrediente()` e `variazione_prezzo()`, che rientrava da una
porta nuova**.

⚠️ **A trovarlo è stata la rete del 19/08**, non una rilettura:
`permessi.test.js` è diventata rossa da sola nominando
`cambio_unita_impedito` fra le funzioni che scavalcano la RLS senza
chiedere chi sei.

La condizione è `auth.uid() is not null and not is_titolare()`: dentro una
migrazione `auth.uid()` è nullo, e senza quella prima metà il portiere
fermerebbe il trigger su ogni cambio fatto da una migrazione futura.

**2. Le funzioni trigger nascono aperte alla chiave pubblica** (trappola
del 15/08). `vieta_cambio_unita` e `converti_numeri_dell_unita` erano
nell'elenco degli anonimi. Nessun dato usciva — fuori da un trigger si
rifiutano di girare — ma *un elenco che cresce in silenzio non è più un
controllo*. Anche qui l'ha detto la prova, diventando rossa da sola.

---

## 🔴 Un difetto nella VERIFICA, trovato rompendola apposta

La prova che il portiere rifiuta era scritta così:

```sql
begin
  update ingredients set unit = 'l' where id = v_ing;
  raise exception 'Il portiere ha lasciato passare…';   -- <-- P0001
exception when sqlstate 'P0001' then …
```

⚠️ **Un `raise exception` senza codice È P0001**, quindi finiva nel proprio
gestore: rompendo il trigger apposta, la verifica diventava rossa dicendo
*«ha rifiutato per un altro motivo»* — mentre il portiere **non aveva
rifiutato affatto**. Diventava rossa lo stesso, ma **mandava a cercare il
difetto dalla parte sbagliata**.

È la trappola già negli appunti («un gestore d'eccezione può inghiottire i
propri stessi controlli»), e si è vista **solo rompendo**. Ora l'esito si
raccoglie in una variabile e si giudica fuori dal blocco protetto.

---

## Come sono state giudicate le prove: rompendo

| cosa è stato rotto | cosa è diventato rosso |
|---|---|
| il criterio «esatto» → «errore < 0,001» | ✅ *«Un prezzo che si perderebbe arrotondando non viene fermato»* |
| il trigger del portiere, tolto | ✅ *«Il portiere ha lasciato passare un cambio di unità impossibile»* |
| una colonna numerica nuova, aggiunta | ✅ *«Ci sono 1 colonne… che nessuno ha classificato: stock_lots.zz_prova_peso»* |
| il portiere della funzione, tolto | ✅ 3 prove su 5 dal client |

Ogni rottura è stata rimessa a posto, e la suite è tornata verde.

---

## ✅ Guardato con l'occhio, sul gestionale di prova

Aperta la scheda di **Aglio rosso di Nubia** (1 lotto, 1,432 kg, ricette,
8,90 €/kg), cambiata l'unità in litri e premuto «Salva modifiche»:

> *Da kg a l non c'è nessuna conversione: quanto pesa un l di Aglio rosso
> di Nubia lo sa solo chi lo compra, e il gestionale non può inventarlo.
> Ci sono già dei numeri scritti in kg (ricette, lotti, prezzi o storico),
> e cambiare l'etichetta li lascerebbe come sono. Se l'unità è sbagliata
> davvero, crea un prodotto nuovo con l'unità giusta e disattiva questo.*

Il messaggio arriva **intero** — `setError(e.message)`, nessun errore
generico che lo nasconda — e dopo il rifiuto il dato è **intatto**:
unità `kg`, prezzo 8,9000, giacenza 1,4320.

⚠️ **E guardandolo si è visto un difetto che nessuna prova vede**: i
messaggi uscivano con gli apostrofi al posto degli accenti («non c'e'
nessuna conversione»). Corretti: le migrazioni si applicano **da file**
(`psql -f`), ed era `psql -c` a rompere gli accenti, non il database.

---

## Una rossa preesistente, trovata girando la suite intera

`allineamento-magazzino.test.js` era **già rossa prima di questo blocco** —
controllato mettendo da parte le mie modifiche e rigirandola. Non era un
difetto del gestionale: la prova sottraeva due decimali **in JavaScript** e
li confrontava con l'uguaglianza esatta, ottenendo `19,999999999999986`
invece di `20`. Il database il conto lo fa giusto.

Corretta con `toBeCloseTo`, fuori mandato e dichiarato: *una prova rossa
che nessuno guarda copre le rosse vere*.

**Suite intera: 621 prove, 620 verdi prima, 621 verdi adesso.**

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** Nessuna decisione presa prima è stata ribaltata da questo
blocco: il difetto non era una scelta, era un controllo che non c'era.

L'unica cosa che si irrigidisce è **implicita e va detta**: fino a oggi
l'unità di un prodotto era un campo come gli altri, modificabile in ogni
momento. Da adesso è modificabile **finché il prodotto non ha una storia**.
Nessuno l'aveva deciso diversamente — semplicemente non ci aveva pensato
nessuno.

---

## ⚠️ Cosa questo blocco NON verifica

1. **La conversione vera non è mai stata esercitata**, perché oggi nessuna
   coppia dell'enum è convertibile. Il ramo che moltiplica e divide le 24
   colonne **esiste e non è mai girato**: lo eserciterà il blocco 2, ed è
   la prima cosa da provare lì.
2. **Non è in produzione**: `npm run migra` si rifiuta finché la migrazione
   non è su GitHub.
3. **Nessuna mano diversa dalla mia** ha visto il messaggio di rifiuto.
4. La misura del 7,69 % è sul **progetto di prova**. In produzione il
   ricettario ha altri prodotti, e i numeri esatti saranno altri — la
   *regola* però non dipende da nessuno di quei numeri.
