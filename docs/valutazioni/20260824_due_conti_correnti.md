# Due conti correnti — cosa comporterebbe

**24/08/2026 — valutazione, non lavoro fatto.** Alessio ha detto che
*potrebbe* aprire due conti correnti e ha chiesto di **misurare cosa
comporterebbe**, senza costruire niente.

> «Non costruire il multi-conto adesso: misura invece COSA COMPORTEREBBE
> e scrivilo. […] Riportamelo nel riepilogo come valutazione, non come
> lavoro fatto.»

**Nessuna migrazione è stata scritta, nessuna colonna aggiunta.** Quello
che segue è misurato sul database vero, non stimato.

---

## 1 · La misura di partenza: la finestra è aperta ADESSO

| cosa | quanto |
|---|---|
| movimenti di prima nota in produzione | **0** |
| righe in `impostazioni_tesoreria` | **0** |
| colonne che dicono «dove stanno i soldi» (`mezzo`) | **7** |
| viste che sommano i saldi | **1** (`v_cash_balance`) |
| funzioni del database che nominano `'banca'` | **3** |
| file del sito che la nominano | **5** |

🔴 **Zero movimenti è il numero che decide tutto il resto.** Oggi
predisporre la struttura non richiede nessuna decisione su nessun dato
già scritto: si aggiunge una colonna e si sceglie un valore predefinito
per un insieme vuoto. Non è una sanatoria — non c'è niente da sanare.

⚠️ **E la finestra non si chiude a marzo 2027**, che è l'apertura: si
chiude **il giorno in cui registri il primo movimento in banca** — le
spese di costituzione, il primo affitto, il primo bonifico a un
fornitore. Cioè poche settimane dopo che il conto esiste.

---

## 2 · Il primo effetto: il saldo banca diventa una somma

Oggi il gestionale conosce **due posti dove stanno i soldi**: la cassa
(il cassetto) e la banca. `v_cash_balance` calcola due saldi separati e
non li somma mai — quella separazione è una decisione del 13/08, ed è
giusta.

Con due conti, «banca» smette di essere **un posto** e diventa **una
categoria**. Il saldo che oggi si legge in una riga diventerebbe la somma
di due, e ogni schermata che oggi dice «saldo banca» dovrebbe dire quale
— o dichiarare che è un totale.

🔴 **E qui c'è il difetto vero, quello che non si vedrebbe.** Se apri due
conti e il gestionale ne conosce uno solo, il saldo banca **continuerà a
comparire, e sarà sbagliato**: sommerebbe i movimenti dei due conti in un
numero unico che **non corrisponde a nessuno dei due estratti conto**.
Non ci sarebbe nessun errore, nessun avviso — solo una riconciliazione
che non torna mai e una causa invisibile.

⚠️ È esattamente la forma che questo progetto insegue da un mese: *un
numero che sembra completo senza esserlo*. Come il saldo di cassa che
escludeva in silenzio gli incassi di sala (14/08), come la sala disegnata
vuota quando una lettura falliva (18/08).

---

## 3 · Il secondo effetto: il POS, e si lega al lavoro di stanotte

Un POS accredita **su un conto**, con **una commissione**. Due conti
possono voler dire due POS, due tempi di accredito, due commissioni.

⚠️ Oggi `impostazioni_tesoreria` ha **una riga per società** con dentro
`giorni_accredito_pos` e `commissione_pos_percento`. Con due POS quella
tabella diventerebbe **una riga per conto**, e la chiave cambierebbe.

✅ **La parte più delicata è già stata sistemata stanotte**: la
commissione ora si conserva **come frazione in tutte e due le tabelle**
dove compare (`impostazioni_tesoreria` e `scenari_proiezione`), col
vincolo che rifiuta i punti. Prima erano in due unità diverse — e il
giorno in cui ce ne fossero state **due o quattro** invece di una,
l'ambiguità si sarebbe moltiplicata invece di chiudersi.

⚠️ **Conseguenza da tenere presente scegliendo la banca**: la domanda
già scritta in §10 di `CLAUDE.md` — *«come arrivano gli accrediti, lordi
o al netto, in quanti giorni?»* — va fatta **per ogni conto**, non una
volta sola. Due banche possono rispondere diversamente, ed è proprio
quella differenza che rende utile saperlo.

---

## 4 · Il terzo effetto: cosa costa aggiungerlo DOPO

Questa è la domanda a cui Alessio ha chiesto una risposta.

**Aggiungere il secondo conto oggi** (con zero movimenti) vuol dire:
- una colonna sulle tabelle che dicono «dove stanno i soldi»;
- un valore predefinito su **zero righe**, quindi nessuna decisione presa
  al posto suo;
- le schermate continuano a funzionare come adesso finché il secondo
  conto non esiste davvero.

**Aggiungerlo dopo** — poniamo a gennaio 2027, con qualche centinaio di
movimenti registrati — vuol dire la **stessa** colonna, **più**:
- 🔴 **decidere, movimento per movimento, su quale conto è passato.** E
  quella decisione **il gestionale non può prenderla**: nei dati c'è
  scritto «banca», non quale. Dovrebbe farlo Alessio, con gli estratti
  conto davanti, per ogni riga.
- ⚠️ **oppure** dichiarare tutto lo storico «conto principale» — che è
  una risposta inventata, e sarebbe **sbagliata proprio sulle righe del
  secondo conto**, cioè quelle per cui la colonna esiste.

⚠️ **È la stessa forma del default del 14/08** — la colonna nuova
`not null default false` che rispose «quel giorno il tavolo è dritto» al
posto di nove scostamenti che dicevano il contrario. Lì il danno fu
visibile subito; qui sarebbe **un saldo bancario che non torna**, e la
causa risalirebbe a mesi prima.

---

## 5 · La raccomandazione

🟢 **Sì, conviene predisporre la struttura adesso** — anche senza
costruire nessuna schermata e anche se poi il secondo conto non lo apri.

Le ragioni, in ordine di peso:

1. **Oggi costa una colonna; fra sei mesi costa una colonna più una
   decisione su ogni riga già scritta.** E quella decisione non ha una
   risposta giusta.
2. **Il costo di predisporre e non usarlo è quasi zero**: una colonna con
   un solo valore possibile si comporta esattamente come se non ci fosse.
   Non compare in nessuna schermata finché non c'è un secondo conto.
3. **Il costo di NON predisporre e poi servirtene è un saldo sbagliato
   che sembra giusto** — il difetto peggiore fra quelli possibili qui.

⚠️ **Cosa NON va fatto adesso**, e va detto perché la tentazione è
naturale: le **schermate** del multi-conto (scegliere il conto quando
registri, i due saldi affiancati, il trasferimento fra conti). Quelle
vogliono decisioni tue che oggi non puoi prendere — non sai ancora quante
banche, quali nomi, quale conto fa cosa. Costruirle adesso significa
indovinare, e il gestionale si porterebbe dietro le risposte sbagliate.

**La forma minima che propongo** (da confermare, non costruita):
- una tabella `conti_bancari` con **una riga sola** all'inizio, che è il
  conto che aprirai;
- su `cash_movements` un riferimento a quella riga, obbligatorio solo
  quando `mezzo = 'banca'`;
- `v_cash_balance` che continua a dire **un** saldo banca finché di righe
  ce n'è una, e comincia a scomporlo da sola quando ne compare una
  seconda.

⚠️ L'ultimo punto è quello che rende la cosa indolore: **finché il conto
è uno, niente cambia a schermo.** La struttura c'è e tace.

---

## 6 · Cosa questa valutazione NON ha guardato

Dichiarato perché nessuno lo dia per fatto:

- **Non ho guardato le schermate una per una** per contare dove
  comparirebbe la scelta del conto: ho contato i **file** che nominano
  «banca» (cinque), non i punti dentro di essi.
- **Non ho misurato l'effetto sulla Proiezione e sulla tesoreria**
  («Ce la faccio al 16?»), che sommano quello che c'è in cassa e in
  banca: con due conti bisogna decidere se la domanda è «ce la faccio
  in totale» o «ce la faccio sul conto da cui esce l'F24». **Sono due
  domande diverse e la seconda è quella vera**, ma la risposta dipende da
  come organizzerai i conti, e oggi non si sa.
- **Non ho toccato niente**: nessuna migrazione, nessuna colonna, nessun
  file del sito modificato per questo.
