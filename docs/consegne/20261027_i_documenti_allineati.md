# I documenti allineati al codice — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** `d1dd04f3`, sul ramo `claude/documenti-allineati` nato da `origin/slave` `26cc6373`. Due commit di correzione sopra la base: `eea7ef43` (README, Contratto §5, specifiche) e `d1dd04f3` (richieste e CLAUDE). Questo riepilogo è il commit successivo. Working tree pulito al commit. **Solo documentazione: nessun codice in `src/`, `supabase/`, `scripts/` o `tests/` è stato toccato, nessuna migrazione, nessuna funzione online, nessun accesso al database.**

## Origine

Verifica dello stato dei documenti contro il codice, come chiesto il 27/10. Le discrepanze del 25/10 erano: README con i 15 moduli «funzionanti» e l'assistente «in attesa»; Contratto §5 con cose costruite segnate come mancanti; specifiche SPEC-0002, 0008, 0009 e 0010 ancora «Bozza»; RICHIESTE senza i lavori dal 15 al 27/10. Ogni affermazione nuova è stata cercata nel codice, nei commit di `master` e `slave`, o nelle PR (lettura con `gh`).

## Cosa cambia

- `README.md`: «Dei 15 moduli del brief ne restano 13» (tolti Ricerca Ricorrente e Monitoraggio Social l'11/10); MEMO (foto e voce) al posto di «Assistente AI in attesa»; Agricolo segnato come messo da parte.
- `docs/CONTRATTO.md` §5, **solo lo stato**: Comande (carta dei vini costruita, restano aperti conto diviso e asporto); Fatture (più caricamento da file); Cassa (più movimenti della banca da file); HACCP (filtro di periodo costruito); Assistente AI (MEMO foto e voce costruiti). Una nota in calce dichiara che la modifica va confermata da Alessio. Regole e categorie non sono cambiate, tranne la categoria dell'Assistente AI, che è scritta come «osservata, da confermare».
- `docs/specifiche/INDICE.md` e le quattro specifiche: SPEC-0002 fatta nella sostanza (10/09); SPEC-0008 fatta (07/09); SPEC-0009 fatta (11/10, con C12); SPEC-0010 fatta (11/09). Nell'indice lo stato è un prefisso di quello della specifica, come richiede la prova.
- `docs/RICHIESTE.md`: 16 righe nuove (U2, A3, A4, C13, C14, C15, R15, R16, R17, V8, V9, V10, e la sezione Sicurezza con Z1-Z4). C2 (estratto conto) passa a fatta; V7 (MEMO che capisce tutto) passa a in corso. Il conteggio è stato rigenerato con `npm run richieste`: 105 richieste, 16 in attesa, 5 in corso, 79 fatte, 5 scartate; delle 21 aperte, 2 si possono fare adesso e 19 aspettano qualcun altro.
- `CLAUDE.md`: data dell'intestazione al 27/10/2026; in §7 una voce sintetica per i lavori dal 15/10 al 27/10, con i rimandi ai riepiloghi. Nessuna sezione storica riscritta.

## Verificato

- **Moduli**: `src/data/modules.js` non contiene più Ricerca Ricorrente né Monitoraggio Social; per MEMO le rotte `/fotografa` e `/detta` sono in `src/App.jsx`.
- **Carta dei vini**: `src/pages/menu-editor/BevandeVini.jsx` esiste, e `src/pages/comande/Sala.jsx` ha la sezione «Carta dei vini». Il percorso `editor-menu/BevandeVini.jsx` citato nel brief non esiste: il file è in `menu-editor/`.
- **Conto diviso e asporto**: non trovati in `src/pages/comande/` né in `src/components/`, quindi restano aperti.
- **HACCP**: `src/pages/haccp/ManualeCompleto.jsx` ha il filtro di periodo (`dal`, `al`) che entra nel documento stampato.
- **SPEC-0002**: `src/pages/documenti/ArchivioDocumentiHome.jsx` apre prima il file, poi legge il documento e mostra una scheda che non entra in archivio prima del Salva (commit `a06fbc11`, 10/09, su `master`). Il pulsante si chiama «+ Nuovo documento».
- **SPEC-0008**: regola «di tasca mia» in `supabase/functions/ascolta-voce/tasca.ts`, commit `4a7a669c` (07/09, su `master`).
- **SPEC-0009**: `src/pages/cassa/DaCollocare.jsx` e migrazione `20261011000002` con `colloca_spesa` (su `master`).
- **SPEC-0010**: commit `da40817e` (11/09, su `master`); classi `riga-campi`, `campo-data`, `campo-ora` in `src/index.css`.
- **Lavori in Agenda**: commento in `src/lib/calcoli/agenda.js` con «chiesto da Alessio il 15/10»; commit `40a7d1f` e `4a458b2c` su `master`; migrazione `20261015000001` presente.
- **Banca e fatture**: `src/lib/calcoli/cbi.js`, `fatturaPA.js` (con «La firma NON si verifica»), `zip.js`; rotte `/cassa/banca` e `/fatture-fornitori/da-file`; `estratto_conto` in `src/lib/constants.js`; migrazioni `20261024000001`→`…000003` e `20261025000001`.
- **Ricette**: migrazioni `20261025000020` e `20261025000021` presenti; commit su `master`.
- **Sicurezza**: `public/_headers` con CSP, `X-Frame-Options: DENY`, `nosniff` e `Permissions-Policy` (camera e microfono solo `self`); `supabase/diagnostica/20261026_audit_permessi.sql`; `supabase/functions/email-cliente/testi.ts`; migrazione `20261026000001`. PR: #236 unita su `slave` il 26/10; #237 unita su `master` il 26/10; #238 unita su `slave` il 26/10, non su `master`; #239 aperta.
- **MEMO su master**: i commit `1270a400`, `502fca5f`, `001a20f6`, `398912a4`, `eadd70d9`, `c0250fd9` sono antenati di `origin/master`. Migrazioni `20261025000003`→`…000005` e `…000041`→`…000043` presenti.
- **Prove**: `npx oxlint` esce a 0 prima e dopo. `npm test`: 2355 verdi e 3 rosse, sempre le stesse (`bozze-col-lordo`, due in `indirizzo-funzioni-vault`, dovute ai CRLF). Due prove (`indice-verifiche`, `investimento`) sono andate in timeout a pieno carico durante una prima esecuzione; rilanciate da sole, 75 su 75 verdi con gli indici.

## Non verificato

- **Produzione**: lo stato delle migrazioni in produzione non è verificato da qui (nessun accesso al database, per regola). Per quanto scritto nei riepiloghi: le migrazioni del 24-25/10 risultano applicate il 25/10; `20261015000001` risulta fra le 421 già applicate (deduzione dal riepilogo del 25/10); `20261025000020`, `20261025000021` e le migrazioni MEMO del 25/10 risultavano non ancora applicate nel momento in cui sono stati scritti i riepiloghi, e lo stato dopo non è nei documenti; `20261026000001` è solo sul progetto di prova.
- **Funzione `email-cliente`**: non è verificato che sia stata reinstallata dopo l'unione.
- **Audit dei permessi** sul gestionale vero: il riepilogo dice che Alessio l'ha lanciato il 26/10 con 24 righe; il risultato non è stato riletto da qui.
- **Intestazioni sul sito in produzione**: verificate solo nella build locale.
- **Schermate**: nessuna aperta; le affermazioni vengono dal codice e dai riepiloghi.
- **Data «MEMO dall'11/08»** (affermazione del brief): non trovata nel codice. Il primo commit di MEMO foto è del 25/08 e quello di MEMO voce del 26/08. Nel README non ho messo una data.
- **Origine** di V10 (#239) e di R17 (frazioni): non si trova nei documenti, segnata «da confermare».
- **Nome del gesto** di SPEC-0002 («+ Nuovo documento» invece di «Carica documento»): da confermare con Alessio.
- **`npm run consegne`** non lanciato: richiede la stringa di collegamento alla produzione.

## Dato per fatto senza misurarlo

- Il fatto che SPEC-0002, 0008, 0009 e 0010 «funzionino come scritto»: ho verificato che il codice c'è e che il commit è su `master`, non che la schermata sia stata provata.
- Le cifre di produzione (421, 427 migrazioni) e le date «in produzione dal 25/10»: prese dai riepiloghi del 24-25/10, non rilette.
- Le frasi già presenti nel README «l'app è online con login reale a due ruoli» e «[il sito] online»: non ricontrollate in questa sessione.

## Affermazioni diventate false durante il lavoro

- README: «Tutti i 15 moduli … funzionante» e «Assistente AI in attesa» (corretti).
- Contratto §5: «carta dei vini non costruita», «manca filtro di periodo», «Assistente AI placeholder, bloccato su account AI» (corrette).
- `docs/specifiche/INDICE.md` e i file di SPEC-0002, 0008, 0009 e 0010: «Bozza» (corretti).
- RICHIESTE: C2 «in attesa» con l'estratto conto già caricabile da file dal 24/10 (corretta); sedici righe mancanti dal 15/10 al 27/10 (aggiunte).
- **Non corretta, da fare**: il paragrafo iniziale di `CLAUDE.md` §7 dice ancora «Tutti i 15 moduli del brief hanno un'implementazione funzionante» e cita «Assistente AI (placeholder)». Non l'ho toccato perché l'istruzione era di aggiornare solo la data e aggiungere la voce. Va riscritto dal titolare o con un mandato apposito.

## Cosa abbiamo rovesciato

Nessuna decisione rovesciata. Il Contratto cambia solo lo stato, e la nota in calce chiede a Alessio di confermare. Nessun rovesciamento nuovo è stato registrato in `docs/decisioni_rovesciate.md`.
