# I due pulsanti di MEMO, e la barra che si misura da sola

**Blocco 4 del mandato del 29/08.** Commit `8a58cab`.
**Nessuna migrazione.**

---

## Cosa abbiamo rovesciato

**Niente.** La voce del 27/08 — *«il gesto principale sta dove arriva il
pollice»* — non viene contraddetta: viene **allargata** da una collocazione a
una misura ricontrollabile, ed è la quinta soglia che Alessio ha approvato il
29/08. Scritta in [`DECISIONI.md`](../DECISIONI.md), sezione *Schermate*.

---

## Misurato prima, a 375 punti

| | MEMO foto | MEMO voce |
|---|---|---|
| larghezza del pulsante | **85** punti | 343 punti |
| frazione dello schermo | **0,23** | 0,91 |
| dove comincia | in basso a **sinistra** | pieno |
| spazio vuoto alla sua destra | **274 punti** | — |
| distanza dal bordo inferiore | **0** | **0** |

Il 23% dello schermo, in basso a sinistra, è il punto più scomodo da
raggiungere con una mano sola — che è esattamente come si tiene il telefono
mentre l'altra mano regge la confezione da fotografare. E la distanza zero dal
bordo è dove su iPhone c'è la barra di sistema.

## Dopo, e le due schermate sono IDENTICHE

| | MEMO foto | MEMO voce |
|---|---|---|
| larghezza | **343** su 375 (0,91) | **343** su 375 (0,91) |
| altezza della barra | **77** | **77** |
| stacco dal bordo | **19** punti (+ la barra di sistema) | **19** |
| lo spaziatore combacia | sì | sì |
| sbordo laterale | **0** | **0** |

Sul computer non cambia niente: **88 punti** come prima, barra di nuovo nel
flusso, nessuno scorrimento.

---

## Tre cose che la misura ha corretto, e nessuna era prevista

**1 · Il primo stacco non era uno stacco.** `0,35 cm` portava da 12 a **13**
punti. Misurato e alzato a `0,5 cm`, cioè **19** — più l'inset della barra di
sistema dove c'è. ⚠️ `env(safe-area-inset-bottom)` **da solo non basta**: su un
iPhone senza quella barra vale 0 e il pulsante tornerebbe appiccicato.

**2 · Sul computer il pulsante diventava largo 710 punti su 1280.** Lì la
regola del pollice non vale. Chiuso con `md:flex-none`.

**3 · Lo spaziatore della barra era un numero passato a mano**, e il commento
del 27/08 diceva già il rischio: *«deve combaciare, o resta un buco o si
copre»*. Adesso **la barra si misura da sola**: non possono più separarsi. Era
il momento giusto per farlo, perché la barra è diventata più alta.

---

## Il censimento: 2 candidati, 0 veri

Metro provato su **tre** casi di risposta nota prima di fidarsene.

| | |
|---|---|
| file con almeno un gesto principale | **9** |
| con **un solo** gesto (in perimetro) | **4** |
| con molti gesti (fuori perimetro) | **5** |
| **candidati fuori regola** | **2** |
| **veri, dopo averli guardati** | **0** |

I due candidati, letti uno per uno:

* **`PuliziaESanificazione`** — è un pulsante **per riga** («Fatta» /
  «Annulla»): uno nel codice, molti a schermo. Non è il gesto unico di una
  schermata.
* **`DatoNonLetto`** — è il «Riprova» del riquadro condiviso che compare
  quando una lettura fallisce.

⚠️ *Un censimento automatico dice dove guardare, non cosa è vero* (regola del
22/08). Qui ha detto due, e guardandoli erano zero.

---

## 🔴 E il metro ha mentito prima di reggere — la quinta volta

Contava **zero** gesti su `ScattaFoto` dove ce n'è **uno**. La causa: nel
codice c'è la scritta `image/*`, e quel `/*` apriva un finto commento che si
chiudeva molto più in basso, **portandosi via il pulsante in mezzo**.

⚠️ E la parte peggiore: i due casi noti che gli avevo dato **non lo
prendevano**, e il terzo che ho aggiunto **passava lo stesso** perché
controllavo solo l'esito e non il **numero**. *Un caso noto che non discrimina
non è un caso noto.* Ora il controllo confronta gesti, barra ed esito insieme.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
- 🔴 **La barra di sistema di iPhone.** Nel browser `env(safe-area-inset-bottom)`
  vale **zero**, quindi ho potuto misurare solo lo stacco di base (19 punti) e
  **leggere** che la dichiarazione la nomina. Che su un iPhone con la barra di
  sistema il pulsante ci stia sopra e non sotto, **non l'ho visto**.
- Il caso «foto già scattata», dove accanto compare «Togli»: provato
  aggiungendo un pulsante finto e misurando che la barra **non cresce**
  (77 prima e dopo). Non l'ho visto con una foto vera.

**Cosa ho contato senza leggerlo**
- I 9 file col gesto principale vengono da un setaccio; ho aperto e letto le
  **9 righe** che lo usano, una per una.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- Avevo scritto che «Fotografa» era largo «un terzo dello schermo», riprendendo
  le parole di Alessio: misurato è il **23%**.
- Il mio controllo «stanno sulla stessa riga» ha risposto **falso** su due
  pulsanti che stanno sulla stessa riga: confrontava il bordo alto di due
  pulsanti di **altezza diversa**, centrati. La prova vera è che l'altezza
  della barra non cambia.

**Cosa ho lasciato sul progetto di prova**
- Niente: nessuna scrittura.

---

## Domande

Nessuna su questo blocco.
