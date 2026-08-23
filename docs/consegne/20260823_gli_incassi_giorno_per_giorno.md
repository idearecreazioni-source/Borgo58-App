# Gli incassi, giorno per giorno

**23/08/2026 — Blocco 4** del mandato «l'unità in grammi, l'avviso sul
prodotto fermo, e due schermate».

| | |
|---|---|
| migrazione | `20260823000015_gli_incassi_giorno_per_giorno.sql` |
| applicata | ✅ progetto di prova — ❌ **non** in produzione |
| schermata | `/cassa/scontrinato` — *Incassato e scontrinato* |

---

## Il buco, e Alessio lo cercava

Fra il **totale del periodo** e il **singolo conto** non c'era niente. La
domanda «quanto abbiamo fatto martedì?» non aveva una risposta in nessuna
schermata: o si guardava il mese, o si contavano i conti a mano.

---

## 🔴 Due colonne, non una — e il caso è nei dati

Il mandato lo chiedeva e i dati lo confermano:

| serata | conti | incassato | scontrinato | da fare |
|---|---|---|---|---|
| **02/06/2026** | 3 | **338,00 €** | **189,50 €** | **148,50 €** |
| 03/06/2026 | 3 | 583,50 € | 583,50 € | — |
| 04/06/2026 | 4 | 645,00 € | 571,50 € | 73,50 € |

⚠️ **Il 2 giugno è il caso che serve a far vedere perché**: con una colonna
sola quel giorno sarebbe indistinguibile dal 3 giugno, dove i due numeri
coincidono.

⚠️ **E la differenza si evidenzia solo quando c'è**: un numero colorato che
compare sempre smette di essere un segnale.

---

## Le scelte, tutte già prese altrove e qui solo rispettate

- si conta a **serate**, non a giorni di calendario — un conto chiuso
  all'una di notte appartiene alla sera prima (regola delle 5, 18/08);
- gli **omaggi non contano**: incassano zero, quindi non c'è nessun
  corrispettivo da emettere;
- l'incasso è **quello che è entrato davvero**, non il valore dei piatti.

🔴 **Il corpo è stato preso vivo da `quadratura_fiscale`** (`npm run
funzione:viva`), non riscritto a memoria: è la stessa regola vista per
giorno invece che in totale, e le due devono restare d'accordo.

---

## La proprietà che tiene insieme le due parti

La verifica non controlla dei numeri: controlla che **la somma dei giorni
faccia il totale del periodo**, su *entrambe* le colonne. Se divergessero,
la stessa schermata direbbe due cose diverse sullo stesso fatto — che è
precisamente ciò che questa schermata serve a scoprire.

✅ **Controllato anche a schermo, non solo nel database**: col periodo
1–3 giugno, il totale in cima dice 921,50 € incassati e 773,00 € con
documento; la somma delle righe della tabella fa **921,50** e **773,00**.
E i 148,50 € «senza documento» sono esattamente il 2 giugno.

---

## Come sono state giudicate le prove: rompendo

🔴 **E la prima rottura non discriminava — è la scoperta di questo blocco.**

Togliendo le fatture dal conteggio dello scontrinato la verifica restava
**verde**: in questo database di fatture non ce n'è **nessuna** (misurato:
319 scontrini, 10 fatture da emettere, **0 fatture**). Stessa cosa per gli
omaggi: **0 conti omaggiati**. *La prova non era falsa — girava su uno
stato di partenza che non conteneva il caso*, ed è la regola del 17/08.

**Il caso ora si costruisce invece di sperare che ci sia**: la verifica
prende un conto vero con scontrino, lo porta a `fattura` (lo scontrinato
non deve muoversi), poi lo lascia **senza documento** (lo scontrinato deve
calare), e infine **rimette la riga com'era** — non ricordandosi a mano
quale colonna aveva toccato (regola del 14/08).

Rirotta, ora è rossa e nomina i numeri:

> *Una fattura non conta fra i documenti emessi: lo scontrinato passa da
> 189.50 a 126.00.*

---

## Coda fuori mandato, dichiarata: «1 conti»

⚠️ **Trovato guardando la schermata**, non cercandolo: l'avvertenza in cima
diceva **«1 conti incassati non hanno ancora un documento»**, e scriveva
gli accenti con l'apostrofo — «finche'», «c'e'», «puo'».

Sono due righe, ed è la schermata dei soldi: *un plurale sbagliato lì fa
dubitare anche del numero accanto*. Corretto in `quadratura_fiscale`
(corpo preso vivo), con un controllo che rifiuta sia «1 conti» sia gli
apostrofi al posto degli accenti.

---

## ⚠️ Un difetto che non era un difetto

Pilotando la schermata, cambiando **due** campi data in rapida successione
il secondo non arrivava allo stato di React e la tabella mostrava 53 righe
invece di 4. **Non è un difetto della schermata**: rifatto cambiando un
campo solo, il filtro funziona esattamente (1–3 giugno → due righe). Lo
scrivo perché la prossima misura pilotata non lo scambi per un guasto.

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** I due totali in cima restano dove sono e dicono la stessa cosa
di prima: la tabella li **scompone**, non li sostituisce.

---

## ⚠️ Cosa questo blocco NON verifica

1. **Nessuna mano diversa dalla mia** ha usato la tabella.
2. **Il caso della fattura vera non esiste nei dati** (0 su 329): è
   costruito e smontato dalla verifica, mai visto in una schermata.
3. **La tabella non ha un limite di righe**, ed è voluto — come le altre
   liste di questa schermata (`.limit()` qui produrrebbe un elenco che
   sembra completo). Su un anno di servizio saranno ~300 righe: da
   guardare quando il locale sarà aperto davvero.
4. **Non è in produzione**.
