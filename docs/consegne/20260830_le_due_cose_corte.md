# Le due cose corte — 30/08/2026 (blocco 3)

**Commit che sta sotto questo riepilogo:** `237c4ec`
**Migrazioni introdotte:** `20260830000003` («Altro» torna agli alimenti).
**Applicate in produzione:** nessuna. Aspetta il push.
**Già applicata stamattina, prima di ogni altra cosa:** `20260830000001`
(«Varie ed eventuali»), che era in coda dalla sessione precedente —
verificata sul database vero: 344 migrazioni, la categoria vecchia non c'è
più, la nuova c'è, i materiali sono 6.

---

## 1. Via «Altro» dai materiali di consumo (3a)

Alessio ha approvato la proposta: «Varie ed eventuali» e «Altro» sono la
stessa idea in due posti, e «Altro» era pure condiviso con gli alimenti. Fra i
materiali ne resta uno solo, il suo.

**«Altro» non si cancella**: resta, e resta legale, per gli alimenti che ce
l'hanno addosso — misurato sul progetto di prova, **16 prodotti alimentari**
stanno lì dentro e non si toccano. Cambia solo l'**ambito**: da «entrambi» a
«alimenti», cioè smette di essere proposto quando si compila la scheda di un
materiale.

🔴 **La sanatoria non era facoltativa.** Misurato: **4 prodotti non
alimentari** stavano dentro «Altro» sul progetto di prova. Cambiato l'ambito,
la loro categoria sarebbe rimasta **legale ma non più proponibile** (regola
del 27/08), quindi aprendo la loro scheda il menu si sarebbe trovato davanti
un valore fuori elenco — e un menu a tendina che riceve un valore fuori
elenco **mostra la prima opzione**, senza nessun errore (trappola del 27/08).
Spostati in «Varie ed eventuali».

⚠️ **In produzione la sanatoria tocca zero righe**: `ingredients` è vuota,
misurato. Lo dichiara invece di tacere.
⚠️ **Si applica una volta sola**, guardando il registro delle migrazioni:
rieseguirla dopo che Alessio avesse rimesso a mano un materiale in «Altro»
sposterebbe indietro una sua scelta legittima.

### Come è stata verificata

Quattro controlli, e non uno: l'ambito è cambiato · fra i materiali il
generico proponibile è **uno solo** (chiesto alla funzione che la schermata
usa davvero, non alla tabella) · fra gli alimenti «Altro» **c'è ancora**, così
togliere il doppione non porta via il generico che serviva · **nessun
materiale** è rimasto in una categoria che non gli si propone più.

Rotta in due modi, su due controlli diversi:

| rottura | dove è fallita |
|---|---|
| l'ambito torna «entrambi» | *«Altro» ha ambito entrambi invece di «alimenti»* (riga 14) |
| un materiale rimesso in «Altro» | *Ci sono 1 materiali in una categoria che non si propone più* (riga 43) |

Rimesso a posto tutto: i 4 materiali sono in «Varie ed eventuali», dove
devono stare.

⚠️ **Una prova automatica diceva il contrario, ed è stata cambiata e non
cancellata.** `tests/app/unita-materiali.test.js` pretendeva `«altro»` fra le
categorie dei materiali: era giusta fino al 30/08. Adesso pretende che **non**
ci sia e che **«varie_materiali» sì**, più che «Altro» resti fra gli alimenti
— senza quest'ultima riga la prova passerebbe anche cancellando la categoria.

---

## 2. Il nome del tavolo, piccolo e intero (3b)

Alessio ha scelto fra le due strade: **piccolo e intero** invece di grande e
tagliato. Il nome nel riquadro delle informazioni passa da
`testo-riquadro-grande` (fino a 7,5 mm, su più righe) a `testo-riquadro`, che
parte da **3,20 mm** — la soglia del progetto, non un'eccezione concessa qui.

⚠️ **La rete resta**: `break-words` non è stato tolto, perché un nome senza
spazi più lungo della riga uscirebbe dai bordi invece di andare a capo.

⚠️ **Non è stato guardato a schermo.** La pianta della sala non è stata aperta
in questo giro: il cambiamento è una classe CSS sostituita, e la classe nuova
è quella usata dalle altre righe dello stesso riquadro.

---

## 3. Cosa abbiamo rovesciato

**Due**, registrati come **n. 69** e **n. 70** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

### n. 69 — «i materiali di consumo tengono due contenitori generici»

1. **Cosa era stato deciso e quando.** Il **30/08 di mattina** (n. 68):
   «Varie ed eventuali» prende il posto di «Imballaggi e asporto», e **«Altro»
   non si tocca**, perché toccarlo avrebbe voluto dire prendere al posto di
   Alessio una decisione che non aveva preso.
2. **La ragione di allora.** La scelta era sua, non mia. La tensione — due
   contenitori generici — era scritta dentro la migrazione e posta a lui come
   domanda.
3. **Cosa si decide adesso.** Ha risposto: «Altro» esce dai materiali.
4. **Perché la ragione di allora non vale più.** Non era sbagliata: **era una
   domanda, e la domanda ha avuto risposta.** ⚠️ E la finestra era stretta: la
   sanatoria è gratis finché nessun prodotto vero sta in mezzo — misurato zero
   in produzione, e fatta adesso invece che fra un mese.

### n. 70 — «il nome del tavolo si mostra grande e va a capo»

1. **Cosa era stato deciso e quando.** La notte del 30/08, poche ore prima:
   il nome tagliato («BASE-Tavolo …») curato mandandolo **a capo** e
   lasciandolo grande.
2. **La ragione di allora.** *Si tronca un nome secondario, non quello per cui
   si guarda il riquadro* (24/08).
3. **Cosa si decide adesso.** Piccolo e intero.
4. **Perché la ragione di allora non vale più.** ⚠️ **Vale ancora per metà**:
   il nome continua a non troncarsi. Cambia il prezzo dell'altra metà — grande
   e su tre righe si mangiava il riquadro, che in servizio deve dire **anche**
   l'ora e i coperti. Le sue parole: *un nome tagliato in servizio non si legge
   comunque*.

---

## 4. Cosa NON è verificato

* **La scheda di un materiale non è stata aperta**: che il menu delle
  categorie non offra più «Altro» è provato **chiedendolo alla funzione che la
  schermata usa** (`categorie_proponibili`), non guardando la tendina.
* **Il riquadro del tavolo non è stato guardato**: nessuno ha visto il nome
  piccolo su una pianta vera.
* **In produzione non c'è nessun prodotto**, quindi la sanatoria di «Altro»
  non ha nessuna riga da spostare: il suo effetto vero si vedrà solo sui dati
  di Alessio.

---

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```
