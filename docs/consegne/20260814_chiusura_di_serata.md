# Consegna del 14/08/2026 (quarta) — chiusura di serata

**Commit della consegna: `66171c5`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `2daf50b` | per la mail si copia PRIMA e si prova ad aprire DOPO |
| `66171c5` | lo stato di fine serata, letto dal connettore |

**Nessuna migrazione nuova.** Produzione: **89 migrazioni**, allineata al
repository (`npm run migra` in sola lettura: *«da applicare: nessuna»*).

Questo riepilogo chiude la serata e copre l'ultima correzione. È pensato
come **punto di validazione complessivo** delle quattro consegne del
13-14/08 elencate in fondo.

---

## 1. L'ultima correzione: `mailto:` non è l'eccezione, è la sua normalità

Un'ora dopo aver messo in funzione il canale mail, Alessio l'ha provato:
Windows gli ha chiesto a chi dare il collegamento `mailto`, ha scelto
Chrome, **e non è successo niente**.

⚠️ **Il caso era dichiarato nel riepilogo precedente** («se Windows non ha
un programma di posta predefinito, `mailto:` non fa niente») — e
dichiararlo non è bastato: **lui la posta la legge dal browser**, quindi
per lui quel caso non è l'eccezione, è la regola. Il risultato era un
ordine registrato e nessuna mail, **senza nessun errore**: esattamente la
forma di guasto che questo progetto cerca di non produrre.

**Correzione**: si **copia sempre prima**, si prova ad aprire dopo. La
copia riesce sempre, l'apertura è un di più. La schermata lo dice due
volte — sotto i pulsanti prima di premere, e con un avviso che nomina
l'indirizzo dopo.

L'avviso **non** sta nel riquadro rosso degli errori: non è un guasto, e
leggerlo come tale insegnerebbe a ignorare il rosso vero.

**Decisione di Alessio a chiusura**: si resta col copia-incolla. Per
l'apertura diretta servirebbe un programma di posta configurato con
`info@borgo58.it` — gli è stato detto che **non disturberebbe il
gestionale** (la posta entra da una copia via webhook, la casella non
viene toccata), e ha scelto di non installarlo finché la mail non sarà un
canale che usa davvero.

---

## 2. Stato della produzione, letto dal connettore adesso

| | |
|---|---|
| migrazioni applicate | **89** |
| funzioni raggiungibili con la sola chiave pubblica | **12** *(invariato)* |
| `security definer` eseguibili da `authenticated` senza portiere | **14** *(invariato)* |
| lavori pianificati | **6** |
| ordini ai fornitori registrati | **6** *(prove di Alessio)* |
| righe in lista della spesa | **2** |
| ingredienti con scorta minima | **2** |
| diciture con fornitore assegnato | **2 su 12** |
| anomalie di scarico | **0** |
| prove automatiche | **46 verdi** (9 pure + 37 sul progetto di prova) |
| lint, build | puliti |

⚠️ **I due numeri di controllo non sono cresciuti in tutta la nottata**,
attraverso cinque migrazioni, due funzioni ricreate con `drop` (dove i
permessi tornano aperti al mondo) e due tabelle nuove.

---

## 3. Cosa è stato consegnato stanotte

| Consegna | Riepilogo |
|---|---|
| Il magazzino scende da solo | `20260813_il_magazzino_scende.md` |
| La lista della spesa (Fase A) | `20260813_la_lista_della_spesa.md` |
| Gli ordini ai fornitori (Fase B) | `20260814_gli_ordini_ai_fornitori.md` |
| La coda della Fase B | `20260814_la_coda_della_fase_b.md` |
| WhatsApp diretto e la mail | `20260814_whatsapp_diretto_e_la_mail.md` |
| Chiusura di serata | **questo** |

**Due mandati avanzati:**

- **«Dal magazzino che scende alla rotta economica»** — Blocco 1 chiuso
  (chiude anche il rilievo 7 del referto). Restano il Blocco 2
  (Produzioni) e il Blocco 3 (Proiezione economico-fiscale).
- **«La filiera della spesa»** — Fasi A e B chiuse e **provate dal vivo**.
  Resta la Fase C (lista a voce), che dipende dalla dettatura del
  Ricettario.

**Del referto sui moduli che toccano soldi e obblighi resta aperto un
solo rilievo**: l'IRAP, che aspetta il parere di Laura.

---

## 4. Quello che vale la pena guardare per primo

Tre punti dove una validazione avversariale ha più da mordere:

1. **Lo scarico del magazzino non solleva mai eccezioni verso chi chiude
   il conto.** È un `exception when others` che ingoia tutto e registra
   l'anomalia. È voluto e provato forzando un guasto, ma è anche il posto
   dove un difetto potrebbe nascondersi per sempre senza far rumore.
2. **`close_order_paid` è nuova e non compare fra i 14 «senza portiere»**
   perché contiene `auth.uid()` — cioè il conteggio la considera
   sorvegliata. Vale la pena verificare che il controllo che ha dentro sia
   davvero sufficiente e non solo formalmente presente.
3. **La quantità d'ordine si arrotonda per eccesso dividendo per
   `fattore`.** Un `fattore` sbagliato produce un ordine sbagliato di un
   multiplo intero, e in schermata i due numeri si vedono — ma nessun
   vincolo impedisce a `fattore` di essere assurdo.

---

## 5. Cosa NON è verificato, per intero

- **Il Ricettario è vuoto** (0 ricette, 0 voci di menu, 0 conti): lo
  scarico del magazzino non è mai stato visto scattare da un piatto
  servito. Le due metà — conto chiuso e giacenza che scende — sono
  provate separatamente, **la giunzione no**.
- **La mail non è mai stata mandata a un fornitore.** Nessuno ha
  `canale_ordine = 'email'`; il collegamento è provato nella forma.
- **10 diciture su 12 non hanno un fornitore**: per quei prodotti la
  bozza userà il nome interno, dichiarandolo.
- **`whatsapp://` provato solo su questo computer**, dove il programma è
  installato. Il caso «non installato» non è stato visto.
- **I dati di collaudo sono in produzione**: sei documenti, i loro
  ingredienti, lotti, storico prezzi, le mail di prova, gli avvisi, **e
  ora anche 6 ordini ai fornitori**. Deroga consapevole di Alessio, da
  chiudere **prima della prima fattura vera di un fornitore vero** — si è
  impegnato a fermarsi e dirlo in quel momento.
- **`/prova-voce` è ancora lì.**
- **Il messaggio delle 10:00 dello scadenziario non l'ha ancora visto
  partire nessuno**: serve un prodotto davvero vicino alla scadenza.
- ⚠️ **Nota di processo, già dichiarata nel riepilogo della coda della
  Fase B**: tre commit correttivi sono stati pushati prima del loro
  riepilogo, mentre si correggeva dal vivo un difetto che bloccava
  Alessio. Sono coperti da `20260814_la_coda_della_fase_b.md`.
