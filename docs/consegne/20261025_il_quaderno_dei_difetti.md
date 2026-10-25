# Il quaderno dei difetti — tappa 1 di «MEMO che controlla»

**25/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `eae126d` (il lavoro è `c52c3a1` + `eae126d`) · ramo `claude/project-thread-xz94pz`, proposta #205 verso `slave` · working tree pulito al commit

## Cosa ha chiesto

Che MEMO lo controlli e che i difetti trovati usando il gestionale arrivino a Claude per essere corretti man mano. Decisioni sue del 25/10: si parte dal quaderno dei difetti; lo staff non segnala; la raccolta è ogni sera; le segnalazioni restano **dentro il gestionale** — il repository è pubblico, e il testo di una schermata della Cassa ha dentro soldi.

## Cosa cambia

**Migrazione `20261025000002_il_quaderno_dei_difetti`.**
- Tabella `segnalazioni`: `testo`, `provenienza` (pulsante · voce · controllo, **senza predefinito**: chi scrive dichiara da dove viene), `schermata`, `titolo_schermata`, `cosa_si_vedeva` (il testo della schermata, al posto di una foto: niente deposito, niente file orfani), `contesto` jsonb, `stato` (nuova · in_lavorazione · corretta · scartata), `esito`, `creata_il`, `creata_da` (`auth.uid()`), `aggiornata_il` (scritto da un trigger).
- Solo titolare: policy `for all to authenticated using is_titolare()`, `revoke all` da public/anon/authenticated, poi `grant select, insert, delete` e **`grant update (stato, esito)`**: testo e contesto sono la testimonianza del momento e non si riscrivono.
- Quattro vincoli `check`, ognuno col `comment` in italiano; `perimetro_registro` = fuori (un appunto di lavoro, non un registro esibibile).
- Verifica: privilegi di anon e di colonna, la policy, il perimetro; poi coi claims del titolare sei controlli (nasce «nuova» col suo autore, l'aggiornamento scrive `aggiornata_il`, stato inventato respinto, provenienza mancante respinta, testo vuoto respinto, `vincoli_senza_frase()` vuoto per la tabella). Annullata con `ZZ_ANNULLA`, `pretendi_nessun_residuo`, auto-registrazione.

**Il pulsante «Segnala»** (`src/components/Segnala.jsx`, `useSegnala.js`): nella testata sul telefono accanto a MEMO, sopra la schermata sul computer; solo per il titolare. Il momento si fotografa **all'apertura**, non all'invio. Guardia sincrona `unaVoltaSola()` contro il doppio tocco; l'esito sotto il riquadro.

**La schermata `/segnalazioni`** (`src/pages/assistente/Segnalazioni.jsx`): aperte e chiuse, stato, esito, «cosa si vedeva» apribile, «Togli». La lettura passa da `leggi()`: se fallisce compare `DatoNonLetto` con «riprova» (la rete `tests/unita/letture.test.js` l'aveva segnalata alla prima stesura).

**Prove**: `tests/unita/segnalazioni.test.js` (5), `tests/app/segnalazioni.test.js` (4: il titolare scrive e rilegge, lo staff non legge, lo staff non scrive, si cambiano stato ed esito ma non il testo).

## Cosa è stato verificato, e come

- Lint a zero, **2285** prove pure verdi, build riuscita, CI verde sulla proposta.
- **Sul progetto di prova**, dal computer di Alessio in una cartella separata: applicata la sola `20261025000002` (la `…001` c'era già). Verifica: esito 0, «zero residui»; la prova ha **428** migrazioni registrate. `npm run test:app -- tests/app/segnalazioni.test.js`: **4 su 4**. Dopo: tabella presente, 0 righe.
- **Schermata aperta e interrogata** (browser integrato, porta propria, riferimento `bnwqgpuyzmzujxfbtyvs` letto nel DOM, PIN di collaudo della prova): a 390 punti il pulsante sta nella barra (86 × 32 punti), a 1280 in alto a destra; **nessuno sbordo** (390/390, 1265/1265, 1280/1280). Riga salvata: schermata `/cassa`, contesto col database di prova, larghezza, altezza, densità; «cosa si vedeva» 1032-1040 caratteri, **senza** il riquadro «Cosa non va?».
- Lo staff, coi permessi veri dell'utente di prova: **0 righe lette** mentre ce n'erano due, scrittura respinta con `42501`.
- Ogni riga di prova tolta per identificativo; dopo, 0 righe e 0 lapidi.

## Cosa NON è verificato

- **Lo staff non è stato guardato con gli occhi**: sulla prova non c'è un PIN di collaudo dello staff. Pulsante nascosto e pagina chiusa stanno nel codice (`isTitolare`, `RequireTitolare`); la barriera vera (RLS) è provata.
- Nessun telefono vero: le larghezze sono finestre del browser, con densità 37,8.
- Nella fotografia della schermata il «?» della didascalia resta su una riga a sé dopo il titolo. Innocuo, lasciato.
- **Non in produzione**: aspetta il merge e l'ordine delle installazioni.

## Diventato falso mentre si lavorava

- Il titolo salvato includeva il «?» della didascalia e, dal computer, la fotografia cominciava con «Segnala»: trovati aprendo la schermata, corretti in `eae126d` e riverificati.

## Cosa abbiamo rovesciato

Niente. Nessuna decisione precedente è toccata.
