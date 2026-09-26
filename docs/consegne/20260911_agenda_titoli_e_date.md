# L'Agenda si legge sul telefono — 11/09/2026

Sola interfaccia. Due giri di collaudo su iPhone: il primo **non approvato**, il
secondo **approvato da Alessio** («Lista e Calendario sono ordinati e
"Riservato" non compare più»).

**Migrazioni**: nessuna. **Funzioni online**: nessuna. **Database**: non toccato.
**HEAD dichiarato**: vedi l'ultima riga.

---

## Cosa cambia

**Elenco dell'Agenda** (`AgendaList.jsx`, `ElencoAdattivo.jsx`)
- Sul telefono la scheda è **spunta | titolo · scadenza · «rimanda» | stella**.
  Spunta, prima riga del titolo e stella hanno lo stesso centro; «rimanda» sta
  sempre sotto la scadenza, nello stesso punto.
- 🔴 **Il vuoto fra titolo e data aveva una causa sola**: spunta e stella sono
  alte 1,2 cm per il dito, e stando nella riga del titolo la allungavano. Ora
  stanno accanto alla colonna: il bersaglio resta 1,2 cm, la scheda si accorcia.
- `ElencoAdattivo` riceve due prop **facoltative**, usate solo dall'Agenda:
  `schedaTelefono` (il dentro del riquadro sul telefono; tocco, tastiera e
  ritirarsi davanti ai comandi restano del componente) e `larghezzaTitolo`
  (`table-fixed`: «Scadenza» cominciava fra 600 e 875 punti a seconda della
  sezione). Chi non le passa non vede niente di diverso.
- Via dall'elenco — anche dal giorno del Calendario — **«Riservato»** e la
  **provenienza**. Il dato di visibilità non è toccato.
- La scadenza vuota («quando capita») si dice se nello stesso gruppo qualcuno
  ha una data: è la regola del blocchetto di serie, persa nel primo disegno e
  **trovata dalla revisione del diff**, non dalla prova.

**Scheda di un impegno** (`TaskForm.jsx`)
- Giorno e ora larghi quanto il contenuto (minimo in cm veri), testo 3,2 mm,
  alti 0,75 cm; affiancati quando ci stanno.
- «Si ripete — ogni [n] [unità]»: il numero portava `w-full` e `w-16` insieme,
  e vinceva il primo.
- La provenienza sta **sotto il modulo**, in piccolo, con la frase di
  `provenienzaImpegno` — che ora riconosce `fatture_fornitori` (origine scritta
  dalla migrazione `20260817000004`): prima quell'impegno si sarebbe detto
  «nato dall'Archivio documenti», che è falso.

## Come è stato verificato

**Prova visiva** (`npm run test:visive`, riscritta): Chrome senza schermo,
vere schermate con letture finte, a **iPhone 390**, **iPhone a 64 punti per cm**
e **computer**. Misura allineamenti, vuoti in cm veri, bordo della stella,
assenza di «Riservato» e provenienza nell'elenco, caselle di data e ora (intere,
non a tutta larghezza, ≤ 0,8 cm), la riga «ogni…», la provenienza in fondo.

| misura | 390 | 64 p/cm | computer |
|---|---|---|---|
| giorno × ora (punti) | 167×28 · 99×29 | 202×48 · 115×48 | 124×28 · 78×28 |
| disposizione | affiancati | a capo (chiederebbero 329 su 310) | affiancati |

- **Verde** sul codice consegnato; **rossa con 91 problemi** sullo stesso
  giro fatto sul codice di partenza `556ba19`.
- 🔴 **Due buchi della prova stessa, trovati facendola girare dove doveva
  fallire**: sul telefono non vedeva la provenienza (arriva attaccata alla
  data, «2026nato dalla posta», e la ricerca pretendeva un confine di parola);
  e il controllo sul «blocco largo» scattava su una scadenza andata a capo.
  Corretti tutti e due.
- **Rottura apposta** della regola «quando capita»: diventano rosse
  esattamente le due forme del telefono, sull'impegno senza data.
- Lint pulito, compilazione riuscita. Prove pure **1296/1297**: la rossa è
  `indice-richieste`, fine riga di Windows, preesistente e verde su GitHub.
  Prove sulle schermate: nel giro completo finale **127/132**. Le rosse
  stanno tutte in `rotte-chiuse` e `varco-pubblico`: rilanciati da soli, due
  volte di fila, danno **3** rosse (`rotte-chiuse` ×1, `varco-pubblico` ×2),
  identiche sul codice di partenza (misurato); le altre 2 sono scadenze a
  5 secondi che col carico del giro completo vanno e vengono.

## Cosa NON è verificato

- **La prova visiva è Chrome.** Safari disegna data e ora a modo suo (niente
  icona, larghezza sua, 16 punti minimi su iPhone non calibrato). Quello che
  vale per l'iPhone è il **collaudo di Alessio**, fatto su questa versione
  meno la regola «quando capita», arrivata dopo.
- **La vista Calendario non è in fotografia**: la prova la apre con un mese
  vuoto. La rimozione di «Riservato» lì è verificata leggendo il codice.
- Nessuna prova contro il progetto di prova: non ci sono scritture nuove.

## Cosa abbiamo rovesciato

Tre rovesciamenti, **tutti decisi da Alessio nel collaudo**, per esteso in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md):

- **n. 88** — la provenienza nell'elenco, in fondo al quadrotto (10/09,
  `42d96cf`). *Vale ancora a metà*: l'informazione resta, a un tocco.
- **n. 89** — il segno «Riservato» nell'elenco (04/08, `fb633ab`, §3.18). *La
  regola vale intera*: esce la spiegazione, non la protezione. Prezzo: dall'elenco
  non si sa più quali impegni lo staff non vede.
- **n. 90** — giorno e ora in due colonne uguali (10/09, `42d96cf`). *Era
  sbagliata la misura*: `min-w-0` stringe la colonna, non la casella.

---

**Hash di HEAD dichiarato**: `eef8b46` sul ramo `agenda-titoli-e-date`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
