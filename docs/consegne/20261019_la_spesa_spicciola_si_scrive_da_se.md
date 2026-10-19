# La spesa spicciola si scrive da sé

**19/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `2d82a44` (fusione di #195 in `master`; il lavoro è `aea6512` + `68fc168`, unito in `slave` con #194)

## Cosa cambia

Prima: ogni riga detta a MEMO per la spesa spicciola diventava un appunto da
approvare, come tutto il resto (SPEC-0013, 06/09).
Dopo: se MEMO era **sicuro** e **non manca niente**, la riga si scrive subito
nella spesa spicciola, dentro un appunto suo già chiuso (`stato = 'approvato'`,
chiuso da chi ha dettato). Se MEMO non era sicuro, o manca qualcosa, resta da
guardare come prima. **La lista della spesa e tutte le altre destinazioni
aspettano come prima.**

Migrazione **`20261019000001`** (`la_spesa_spicciola_si_scrive_da_se`):

- colonna `tipi_azione_vocale.senza_approvazione boolean not null default false`,
  accesa sul solo `spesa_spicciola`. Il predefinito qui non risponde al posto di
  nessuno: per le righe esistenti «aspetta Alessio» è la regola in vigore.
- vincolo `senza_approvazione_solo_se_eseguibile` (`not senza_approvazione or eseguibile`),
  con la sua frase in italiano.
- `scrivi_dettatura` riscritta **dal corpo vivo** (guardia sull'impronta
  `6d823efe99f2a54c154f7ad016c2fdf8`, quella della `20260909000002`; si ferma se
  il corpo è stato toccato dopo). La riga sicura passa da `fai_azione_dettata`,
  cioè dalla stessa esecuzione dell'approvazione a mano: nessuna seconda strada.
  Restituisce anche `eseguite` e `da_guardare`.
- se la scrittura fallisce, la riga resta `in_attesa` col motivo, in un appunto
  aperto: niente sparisce in silenzio.
- blocco di verifica in sotto-transazione annullata (riga sicura scritta una
  volta sola, riga incerta in attesa, lista della spesa in attesa, scrittura
  fallita rimasta da guardare, appunto aperto non toccato), poi auto-registrazione.

Prove: `tests/app/due-liste.test.js` — due prove nuove (spicciola sicura scritta
da sola, incerta che aspetta) e una corretta: la prova della pulizia approvava
una spicciola **sicura**, che ora nasce già chiusa e non si può più approvare
(«Questo appunto era gia' stato chiuso»). Ora la detta incerta, apposta.

## Verifiche

- **Progetto di prova**: applicata con `npm run prova:migra` (prova a 422
  migrazioni). `tipi_azione_vocale` ha `spesa_spicciola | t` e nessun'altra riga
  accesa. Zero residui.
- **Proposta #194 verso `slave`**: tutti i controlli verdi su `68fc168`.
- **Giro di `slave`** (run 39254797853): al primo tentativo 617 su 618, scaduta
  per tempo `evento-accettato` (30 s) e una pulizia con `fetch failed` in
  `vincoli-chiusura-anno`; rilanciato una volta il solo lavoro fallito,
  **618 su 618**, e pubblicazione su Borgo58-Prova riuscita.
- **Proposta #195 `slave` → `master`**: al primo tentativo 617 su 618, scaduta
  per tempo `tre-esiti-lista > comprata e pagata`; stesso commit già verde sul
  giro di `slave`, rilanciato una volta, verde. Commento sulla proposta.
  ⚠️ Le tre scadenze sono tre prove **diverse**, nessuna tocca la spesa
  spicciola: è il progetto di prova lento, non un difetto di questa modifica —
  ma è una famiglia che si ripresenta e non è stata indagata qui.
- **Copia di sicurezza** prima di applicare: `2026-10-19_1448`
  (`Borgo58_backup_2026-10-19_1448.zip`, 757 KB, 141 tabelle, 1648 righe,
  4 utenti, 3 documenti), nessun errore. Lo script stesso avverte che prova la
  completezza del file, non il ripristino.

## Applicazione in produzione

**Primo tentativo, 19/10 alle 14:06, fermato dalla guardia — niente applicato**
(produzione rimasta a 421). La guardia di `20261019000001` confronta
`md5(prosrc)` di `scrivi_dettatura` con `6d823efe99f2a54c154f7ad016c2fdf8` e in
produzione ha trovato `53faf27163a43d14534354a4cdd566e9`. Misurato in sola
lettura: `md5(replace(prosrc, E'\r\n', E'\n'))` in produzione vale
**`6d823efe99f2a54c154f7ad016c2fdf8`**. Il corpo è identico; cambiano solo gli
a capo — le migrazioni di produzione si applicano dal computer di Alessio
(Windows, CRLF), quelle della prova da Linux (LF), e Postgres conserva il corpo
byte per byte.

Cura: migrazione nuova **`20261019000002`**
(`la_spesa_spicciola_anche_con_gli_a_capo_di_windows`), non una riscrittura della
`20261019000001` (già applicata sulla prova). Stesso contenuto della `…001`
dalla riga 53 in giù, con la guardia che normalizza gli a capo prima
dell'impronta, e registra **entrambe** le versioni. In produzione si applica con
`npm run migra -- --salta 20261019000001 --conferma`; la `20261019000001` resta
da saltare anche in una ricostruzione da Windows.

*Numeri veri dopo l'applicazione: da completare.*

## Cosa NON è verificato

- **Nessuno ha dettato a MEMO dopo la modifica**: la catena voce → modello →
  `scrivi_dettatura` è provata dal database in giù, non dal microfono. Se il
  modello marchi «sicuro» le righe giuste non è misurato.
- **La schermata degli appunti non è stata aperta**: come si vede un appunto
  già chiuso scritto da sé, fra gli altri, non l'ha guardato nessuno.
- La riga residua lasciata dalla pulizia fallita sul progetto di prova
  (`chiusure_annuali/a6de5fb5-7d51-4499-991b-b24bbca84ab7`) non è stata
  controllata né tolta.

## Cosa abbiamo rovesciato

1. **Cosa era stato deciso e quando**: 06/09/2026, SPEC-0013
   (`20260906000001`), ribadito il 07/09: nessuna dettatura scrive niente prima
   che Alessio approvi.
2. **La ragione di allora**: la comodità non giustifica una registrazione non
   riletta.
3. **Cosa si decide adesso**: per la sola spesa spicciola, una riga sicura e
   completa si scrive da sé (`tipi_azione_vocale.senza_approvazione`).
4. **La ragione di allora vale ancora, e questo è il prezzo che accettiamo**:
   vale intera per soldi, magazzino, registri e Agenda, che continuano ad
   aspettare. Sulla spesa spicciola non morde — non muove soldi né giacenze e
   una riga si toglie con un tocco; il prezzo è che una parola capita male
   finisce in lista senza essere riletta.

Riga **104** in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).
