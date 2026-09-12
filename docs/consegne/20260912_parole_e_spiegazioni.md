# Una parola per una cosa, e le spiegazioni fisse: il documento — 12/09/2026 (mandato esteso, priorità 3)

**Solo documentazione.** Nessun testo a schermo cambia. **Migrazioni**:
nessuna. **Funzioni online**: nessuna. **Database**: solo letture. **HEAD
dichiarato**: vedi l'ultima riga.

---

## Cosa c'è

`docs/proposte/20260912_parole_e_spiegazioni.md`:
- **§1, le parole**: undici gruppi. Per ognuno: dove compare, una proposta
  unica, il motivo e l'impatto, e se una PR aperta lo cambia già. «task» →
  «impegno» è già tutto nella #60 e non si tocca.
- **§2, le spiegazioni sempre visibili**:
  - riga per riga Sala e orari (16), Previsione (9) e Mance (2), ognuna con
    «resta», «nel ?» o «via» e il perché;
  - le altre 73 righe raggruppate per proposta: 39 restano, 26 nel «?», 5
    via, 2 da non toccare senza Alessio, 1 già sistemata dalla #57.
- **§3, i difetti trovati facendo il censimento**, non corretti.
- **§4, l'ordine** in cui applicarle dopo le scelte di Alessio.

Nessuna spiegazione economica, fiscale, legale o su un gesto irreversibile è
proposta «via». Sala e orari, Previsione e Mance sono file della #57: ogni
scelta lì si applica dopo la sua unione.

## Come è stato fatto e verificato

- Due censimenti in sola lettura sul codice di master (`59f4d2d`), uno per
  le parole e uno per le spiegazioni, affidati a due aiutanti con l'ordine
  di non scrivere niente. Per ogni riga è controllato con `git diff` se la
  #57, la #58, la #60, la #63 o la #65 la cambiano.
- **Ricontrollati da me** sul codice:
  - `Detta.jsx:530` passa `testo=` e `Didascalia` legge solo `children`;
  - `ritardo.js:267-268` dice «Primo giro» e «primo turno»;
  - `Dashboard.jsx:609` scrive `{t.category}`, e la riga 219 dice «le cose
    che hai dettato»;
  - `SalaEOrari.jsx:344-348`, `sala.js:343-365`: la lettura delle regole non
    chiede `ora_primo_turno`, e il salvataggio lo scrive in
    `service_settings`.
- **Sul database, in sola lettura** (catalogo di produzione, 12/09):
  `ora_primo_turno` esiste solo in `service_hours`, non in `service_settings`.
- Le righe raggruppate del §2 (le 73) le ho contate io, una per una, sulla
  tabella del censimento. Il suo riepilogo ne diceva 70: il numero giusto è
  73, e il documento lo dice.
- Prove pure: **1295/1297**. Le due rosse sono i fine riga di Windows, rosse
  anche su master. Il ramo non tocca codice.
- `git merge-tree` con i rami di #57–#70: nessun conflitto.

## Cosa NON è verificato

- I numeri di riga e i conteggi che non ho ricontrollato sono quelli dei due
  censimenti.
- Nessuna schermata è stata aperta per questo documento. Il campo rotto di
  Sala e orari è letto dal codice e dal catalogo, non premuto.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `4883425` sul ramo `parole-e-spiegazioni`, cioè
il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
