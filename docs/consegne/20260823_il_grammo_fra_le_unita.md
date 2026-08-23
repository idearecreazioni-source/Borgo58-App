# Il grammo fra le unità, e la soglia che si dichiara

**23/08/2026 — Blocco 2** del mandato «l'unità in grammi, l'avviso sul
prodotto fermo, e due schermate».

Entra **dentro** la protezione del blocco 1, che non viene toccata: da oggi
kg e g sono l'unica coppia convertibile, e la conversione avviene solo se
non perde nessun numero.

| | |
|---|---|
| migrazione | `20260823000012_il_grammo_fra_le_unita.sql` |
| applicata | ✅ progetto di prova — ❌ **non** in produzione |
| app | `src/lib/constants.js` — una riga |

---

## Perché i grammi, e non le bustine né i milligrammi

Decisione di Alessio. Le **bustine** danno più margine (667× contro 67×) ma
legano al formato: cambiando fornitore o taglia i conti vanno rifatti. I
grammi sono universali, il prezzo resta leggibile e 67× sul caso peggiore
è ampio — servirebbe una ricetta da cento volte più porzioni.

🔴 **E non il milligrammo, per una ragione che non si può correggere dopo:
un valore di enum non si toglie.** In mg tutti i prezzi si vedrebbero
«0,00 €» — misurato su nove spezie su nove.

✅ **Confermato con l'occhio, non calcolato**: creato lo zafferano a 2,40 al
grammo dalla schermata vera, la scheda mostra **`2,40 €/g`**. È esattamente
il numero che in milligrammi sarebbe stato `0,00 €/mg`.

---

## 🔴 La soglia, che è la metà più importante di questo blocco

Il limite è **0,0001 in qualunque unità**, e non è una proprietà
dell'unità: sta nei **campi** — tutti `numeric(12,4)`. E morde **già nella
riga di ricetta**, prima di ogni scarico: è il difetto della cannella alla
radice.

**Misurato**: scrivendo `0,00003` in una riga di ricetta, il database
conserva **`0,0000`** — senza errore, senza avviso.

### 🔴 E un trigger non può distinguere «zero scritto» da «zero arrotondato»

Misurato con una spia: messo un trigger `BEFORE INSERT` davanti a quella
colonna, davanti a un `0,00003` **il trigger vede già `0.0000`**.
L'arrotondamento avviene nella coercizione al tipo della colonna, cioè
**prima** che qualunque nostro codice possa guardare.

⚠️ **Quindi la cura non è distinguere i due casi: è rifiutarli entrambi** —
che è anche giusto nel merito, perché una riga di ricetta con quantità zero
non ha senso comunque. Il messaggio li nomina tutti e due, così chi legge
sa in quale dei due si trova.

### La via d'uscita cambia con l'unità

| il prodotto è in | il messaggio dice |
|---|---|
| **kg** | «…cambia l'unità del prodotto in grammi: lì lo stesso pizzico si scrive senza perderlo» |
| **g** | «…sotto quella soglia non c'è un'unità più piccola: conviene metterla nella preparazione che la contiene» |

⚠️ **Proporre i grammi a chi è già in grammi sarebbe un vicolo cieco
travestito da aiuto** — un consiglio che non si può seguire.

⚠️ **Nessuna sanatoria**, e la ragione è misurata: righe di ricetta a zero
**0 su 317**, scarichi **0**, righe di lista **0**, produzioni **0**. La
quantità più piccola che esiste oggi è **0,0002 kg** — due volte il limite,
che è quanto stretto fosse il margine senza i grammi.

---

## 🔴 Il ramo che converte ha girato per la prima volta

Il blocco 1 costruiva la conversione ma non poteva provarla: nessuna coppia
dell'enum era convertibile. Ora sì, e la verifica la esercita per intero su
un prodotto a 12,50 €/kg con un lotto da 2 kg:

| | da kg a g | e tornando indietro |
|---|---|---|
| giacenza del lotto | 2 → **2000** | → **2** |
| prezzo | 12,50 → **0,0125** | → **12,50** |
| costo del lotto | 12,50 → **0,0125** | |
| scorta minima | 1 → **1000** | |

⚠️ **Il costo del lotto è il controllo che vale di più**: se restasse 12,50
al grammo, quel lotto varrebbe **25.000 €** invece di 25.

Il ritorno esatto ai numeri di partenza è la controprova che la conversione
non perde niente.

---

## Come sono state giudicate le prove: rompendo

| cosa è stato rotto | cosa è diventato rosso |
|---|---|
| il trigger della soglia, tolto | ✅ *«Una quantità che il campo non sa conservare è stata scritta come zero»* |
| il ramo dei kg cattura anche i grammi | ✅ *«A un prodotto già in grammi viene proposto di passare ai grammi»* |
| il prezzo si moltiplica invece di dividersi | ✅ *«Il prezzo non ha seguito l'unità: 12500,0000 invece di 0,0125»* |
| `g` tolto da `constants.js` | ✅ *«il database ammette g e la schermata non li offre — un valore legittimo che nessuno può scegliere, e in silenzio»* |

### 🔴 E una rottura ha trovato un buco nella verifica

Spegnendo il **ramo dei grammi** (invece del ramo dei kg) la verifica
**restava verde**: il controllo scritto era *«non deve proporre i grammi a
chi è in grammi»*, cioè verificava un'**assenza** — e con il ramo spento la
via d'uscita spariva del tutto, quindi l'assenza c'era ancora.

⚠️ *Una prova che verifica solo ciò che NON deve esserci passa anche quando
non c'è più niente.* Aggiunto il controllo positivo: il messaggio deve
**nominare la preparazione**. Rirotto: ora diventa rossa.

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** Il vocabolario delle unità non era stato chiuso per decisione:
kg, l, pz e mazzo erano semplicemente quelle che servivano. Il grammo si
aggiunge senza contraddire nessuna scelta precedente.

⚠️ **Ma una cosa si irrigidisce e va detta**: fino a oggi una riga di
ricetta poteva avere quantità zero. Da adesso no. Nessuno l'aveva deciso —
non c'era nessun controllo — e nei dati veri non è mai successo (0 su 317).

---

## ⚠️ Cosa questo blocco NON chiude

1. **Il rifiuto è sulla riga di ricetta soltanto**, che è dove il mandato
   dice che morde. Gli altri posti, dichiarati: `stock_lots.quantity_received`
   è già protetto da un check `> 0` (con messaggio da database, non da
   persona); `stock_consumptions.quantity` è una **conseguenza** e nasce dal
   fabbisogno, ora protetto a monte; `shopping_list_items.quantity_needed`
   può essere zero — inutile ma non falso, e la riga si vede.
2. **Nessun prodotto vero è stato messo in grammi.** Lo zafferano di prova è
   stato creato, guardato e **cancellato**: zero prodotti `ZZ` rimasti,
   lapidi invariate (68 prima, 68 dopo). Quando Alessio metterà zafferano e
   cannella in grammi, il gestionale userà **il ramo che converte**, che da
   oggi è provato ma non è mai girato su dati suoi.
3. **Il messaggio della soglia non è stato visto a schermo** da una mano:
   è provato dentro la migrazione, non aprendo l'Editor Ricette.
4. **Non è in produzione**: `npm run migra` si rifiuta finché la migrazione
   non è su GitHub.
