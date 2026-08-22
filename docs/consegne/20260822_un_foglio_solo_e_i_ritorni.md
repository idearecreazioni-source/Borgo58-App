# Un foglio solo — e i pulsanti per tornare indietro

**Nato da**: una correzione del validatore. Nel mandato dei turni era scritto
*«la Cucina raggruppa le righe per turno e stampa un foglio per gruppo»*, ma
Alessio aveva chiesto un'altra cosa: **righe di separazione dentro la
comanda**, non fogli separati — *«io ho già la comanda completa e vedrò cosa
devo ancora cucinare per quel tavolo»*.
**Nessuna migrazione.**

---

## 1 · Adesso il foglio è uno solo

| | prima (21/08) | adesso |
|---|---|---|
| comanda a 3 turni, 7 piatti | **3 fogli** | **1 foglio**, coi 3 turni separati dentro |
| la banda del turno | in cima a ogni foglio | **dentro il foglio**, prima dei piatti di quel turno |
| il biglietto «avanti prossimo turno» | foglio suo | **invariato** |
| l'aggiunta | foglio suo, col turno | **invariata** |

⚠️ **E il difetto di partenza resta chiuso**, che è la parte delicata: il
problema del 21/08 **non era il foglio unico** — era che i turni **non si
vedevano**. Prima di allora quelle sei righe uscivano su un foglio solo
**mescolate**; adesso escono su un foglio solo **separate**. *Un foglio con
dentro le divisioni non è la stessa cosa di un foglio senza.*

⚠️ **Il lavoro sulla carta non si è buttato**: la banda resta a **6,35 mm** in
stampa e 3,24 sullo schermo, identica. Cambia solo che ce ne sono tre sullo
stesso foglio invece di una per foglio.

---

## 2 · 🔴 Quanto è lungo il foglio — misurato

Il mandato chiedeva di misurarlo, e non era una domanda oziosa: tre bande
grandi su un rotolo si notano.

**Misurato copiando il foglio vero, dandogli la larghezza della carta (72 mm
= 272 punti) e rimettendo a ogni riga la taglia di STAMPA** — non quella
dello schermo, che su un rotolo non esiste:

| | |
|---|---|
| comanda | T7 · T8 · T9, **3 turni, 7 piatti** |
| larghezza | 72 mm |
| **lunghezza sulla carta** | **11,6 cm** |
| righe stampate | 12 |

✅ **Non è un rotolo**: sono meno di dodici centimetri, la lunghezza di uno
scontrino normale. ⚠️ E con tre fogli separati sarebbe stata **più** carta —
tre intestazioni «CUCINA — tavolo» e tre orari invece di uno.

⚠️ **È un conto, non un foglio uscito da una stampante**: la traduzione da
punti a millimetri è quella standard del browser (96 punti per pollice).
Nessuna termica ha ancora stampato niente.

---

## 3 · Come si raggruppa adesso — e una firma invece di una posizione

- **le righe da stampare** di un conto: **un foglio**, coi turni dentro —
  ⚠️ e la chiave è il **conto**, non l'invio: due invii mai stampati
  finiscono sullo stesso foglio, che è quello che serve a chi cucina;
- **le righe già uscite**: raggruppate per `prepared_at`, cioè **la firma
  della stampa con cui sono uscite**. ⚠️ Così una ristampa riproduce
  *esattamente* la carta di prima; raggruppandole per invio, una ristampa
  avrebbe dato un foglio diverso dall'originale;
- **le aggiunte**: un foglio per turno, come prima, perché sono roba che la
  cucina non ha mai visto.

⚠️ **Solo il foglio dell'aggiunta dichiara UN turno**; gli altri ne portano
dentro quanti ne servono. È scritto nel codice perché è la differenza fra i
due tipi di foglio.

**Le prove**: le 11 pure diventano **14**, e la vecchia *«esce in tre fogli»*
è stata **capovolta** dichiarando perché. Sui dati veri, la prova che legge
con la stessa select della Cucina è stata aggiornata allo stesso modo.

**Due rotture, fatte e rimesse a posto:**

| cosa ho rotto | cosa è diventato rosso |
|---|---|
| torna a un foglio per turno | *«esce in UN foglio, coi tre turni dentro»* |
| le righe uscite si raggruppano per invio invece che per stampa | *«si raggruppano per la STAMPA con cui sono uscite»* |

---

## 4 · I pulsanti per tornare indietro

Alessio ha ragione: in Cucina «Sala» e «Bar» erano **6,43 mm**, sotto la
soglia. **Non erano nel mio elenco** — il censimento di stamattina li contava
come collegamenti, ma nei due giri avevo sistemato i pulsanti e i link solo
sulle schermate che stavo toccando.

**Sistemati adesso** i tre delle Comande:

| | prima | dopo |
|---|---|---|
| Cucina → «Sala», «Bar» | 6,43 mm | **8,50 mm** |
| Bar → «Sala», «Cucina» | 6,43 mm | **8,50 mm** |
| Scontrini → «← Sala» | 4,00 mm | **8,50 mm** |

### 🔴 E su tutto il gestionale sono **44**

Contati: **62 «torna indietro»** in tutto, e **44 non hanno nessuna misura di
tocco**. Per modulo:

| modulo | quanti |
|---|---|
| ricettario | 10 |
| fiscale | 7 |
| calendario | 7 |
| cassa | 5 |
| magazzino | 3 |
| documenti | 3 |
| editor menu | 2 |
| agenda | 2 |
| personale · haccp · agricolo · privacy · placeholder | 1 ciascuno |

⚠️ **Sono il caso di scuola di quello che il mandato dice**: si premono di
fretta, non fanno niente di pericoloso, e **nessuno li conta fra i pulsanti
importanti** — infatti non erano in nessuno dei due giri, e li ha visti
Alessio in due secondi.

⚠️ **Io non li ho toccati fuori dalle Comande** — cadono quasi tutti nel
terzo gruppo, quello che aspetta le crocette. ✅ **Li ha fatti tutti e 44
una sessione parallela poco dopo** (commit `40c2bb3`), quindi il conto qui
sopra è la fotografia di com'erano, non di come sono.

⚠️ **E c'è un pezzo che nessuno dei due elenchi poteva contenere**: il
pulsante «Apri menu» e le voci della barra laterale — **5,14** e **5,07
mm** — stanno nel layout condiviso, cioè *in nessuna schermata e in tutte*.
Il mio censimento guardava dentro `<main>`, quindi non li vedeva; li ha
trovati la sessione parallela e li ho sistemati io (`8dfd653`). *Un difetto
che sta dappertutto non compare in un elenco fatto per posti.*

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Niente è uscito da una stampante**: gli 11,6 cm sono un calcolo sulla
   geometria della pagina, non carta misurata.
2. 🔴 **Non l'ha visto un occhio**: so cosa c'è sul foglio e quanto è lungo,
   non come si legge in cucina di sera.
3. ⚠️ **Il caso della ristampa non l'ho fatto a mano**: che una ristampa
   riproduca la carta di prima è provato dalla regola (`prepared_at`), non da
   due stampe vere.
4. ⚠️ **I 44 ritorni non sono stati aperti uno per uno**: il conto viene dal
   codice, cercando chi ha una freccia e non ha una misura di tocco. Il
   numero è affidabile, la loro misura precisa no.

---

## Cosa abbiamo rovesciato

**Uno, ed è la correzione stessa**: il foglio della cucina torna a essere
**uno solo**.

⚠️ **E qui c'era una frase falsa scritta da me poche ore fa, corretta da
una sessione parallela**: avevo scritto *«un foglio per invio»* in tre
punti di questo documento e nel commento del codice. **È il conto che fa
il foglio, non l'invio**: nella chiave di ciò che deve ancora uscire
l'istante dell'invio non c'è, quindi **due invii mai stampati fanno un
foglio solo** — che è anche il comportamento giusto, perché la cucina
vuole in mano tutto quello che deve ancora cucinare per quel tavolo.
*Una frase diventata falsa il giorno stesso in cui è stata scritta* — la
quarta in tre giorni, e la prima che non ha avuto bisogno di invecchiare.

- **cosa era stato deciso, e quando**: 21/08, un foglio per turno
  (rovesciamento n. 26, *«un ticket è un INVIO»* → un turno);
- **la ragione di allora**: una comanda mandata tutta insieme usciva come un
  foglio solo coi tre turni **mescolati**, e la cucina avrebbe fatto partire
  il dolce con l'antipasto;
- **cosa si decide adesso**: un foglio per **conto**, **coi turni separati
  dentro**;
- **perché quella ragione non vale più — ⚠️ e in realtà vale ancora, ed è per
  questo che il rovesciamento è parziale**: la ragione era *«i turni non si
  vedono»*, non *«i fogli sono pochi»*. Adesso si vedono. **Quello che si
  rovescia è il rimedio, non la diagnosi** — e il rimedio era mio, non di
  Alessio: la sua richiesta erano le righe di stacco, e il foglio in più
  l'avevo aggiunto io traducendola male.

⚠️ **Il n. 26 resta valido per la parte che conta**: la chiave del
raggruppamento **non è più `sent_at` e basta**, e il turno si vede sempre.

---

## 5 · Cosa ho guardato

Composta una comanda vera a **tre turni e sette piatti** su T7·T8·T9 (90,00 €),
inviata tutta insieme, e aperta la Cucina: **un foglio solo**, con
`CUCINA — T7 · T8 · T9`, l'ora, e dentro le tre bande coi rispettivi piatti.
Poi la misura della lunghezza sulla carta.

**Ripulito**: i due conti di prova, in modo mirato e coi due trigger spenti e
riaccesi controllando. **0 conti aperti**, trigger **accesi**.

**Suite**: 261 prove pure, 303 sui dati veri. Tutte verdi.
