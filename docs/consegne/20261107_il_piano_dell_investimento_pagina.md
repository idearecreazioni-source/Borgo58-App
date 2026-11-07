# Il piano dell'investimento — 2: la pagina (07/11/2026)

Seconda delle 6 PR del piano dell'investimento. Nessuna migrazione: usa le tabelle della parte 1 (`20261107000001`).

## Cosa entra
- **La pagina** `/cassa/costo-progetto/piano`, protetta da RequireTitolare. Ci si arriva dal pulsante «Piano dell'investimento →» in «Quanto è costato il progetto».
  - In alto: il previsto in tutto, quante voci non quadrano e il mese dell'apertura. La data si cambia con il pulsante «Salva la data».
  - I gruppi da A a E. Ogni voce mostra stato, dilazione, IVA, netto, importo e ✓/✗ (detto anche a parole per chi usa un lettore di schermo). Ci sono «Modifica» e «+ Aggiungi una voce».
  - Il modulo della voce contiene:
    - nome, gruppo e previsto IVA inclusa;
    - l'IVA, con il netto calcolato accanto;
    - stato e dilazione;
    - l'acconto e i 12 mesi dall'apertura;
    - una nota;
    - «Archivia la voce».
  - «Quanto paghi ogni mese»: le rate del piano, mese per mese.
  - Voci archiviate, con «Riprendi».
- **Gli importi si scrivono all'italiana.** `leggiImporto` legge «16.000» come sedicimila e «1.500,50» come millecinquecento e cinquanta. Un importo che non si capisce ferma il salvataggio: non diventa zero.
- **Un salvataggio fermato a metà** (la voce scritta, le rate no) porta con sé l'id della voce. Il secondo tentativo aggiorna quella voce invece di crearne una doppia.
- **Un modulo alla volta**: mentre una voce è aperta, le altre voci e la data non si toccano.
- **Testi aggiornati.** «Serve fino a marzo 2027» non vale più per il piano, che arriva a ottobre 2027. Cambiati in CostoProgetto, PrimaNota e CassaHome.
- **Prove**:
  - `tests/schermate/piano-investimento.test.jsx` (19 prove);
  - `leggiImporto` e `importoNelCampo` in `tests/unita/piano-investimento.test.js`.

## Cosa NON entra
- **Lo speso vero e lo sforamento**: arrivano nella parte 3, con i collegamenti. La pagina lo dice.
- **Le fatture nello scadenziario**: arrivano nella parte 4.

## Controlli
- Revisione `ecc:react-reviewer`. Corretti:
  - gli importi all'italiana;
  - il salvataggio a metà che creava una voce doppia;
  - il previsto vuoto salvato a zero;
  - un modulo alla volta;
  - la data con il suo pulsante;
  - la pagina che non lampeggia;
  - ✓/✗ detti a parole.
- Il controllo a schermo non è fatto: l'accesso al gestionale in locale chiede il PIN di Alessio.
