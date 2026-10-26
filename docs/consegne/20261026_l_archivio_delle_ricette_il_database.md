# L'archivio delle ricette — il riepilogo del primo rilascio (solo database)

**26/10/2026** · riepilogo di sola documentazione · commit sotto questo riepilogo: `a6a6e84` (slave dopo #230) · le migrazioni sono entrate su master con #228 (`1d3bde6`) · ramo `claude/project-thread-7v8uro`, proposta verso `slave`

## Perché esiste questo riepilogo

Dal 25/10 l'unione su master va online da sola. Il lavoro del Ricettario è stato quindi diviso in due rilasci:
1. le sole migrazioni, compatibili col codice di adesso;
2. il codice che le usa.

Il primo è su master. Il 26/10 alle 10:36 ora italiana, dal computer di Alessio, su un worktree di `origin/master` a `1d3bde6`, sono stati lanciati due comandi:
- `npm run backup` è riuscito: 144 tabelle, 1687 righe, 4 utenti, 3 documenti, file `Borgo58_backup_2026-10-26_1036.zip`.
- `npm run migra` in sola lettura ha detto «438 nel repository, 436 in produzione» e poi si è fermato: «queste migrazioni stanno per entrare in produzione e nessun riepilogo le nomina».

Il controllo aveva ragione: le due versioni erano scritte per intero solo nella proposta #227, non in `docs/consegne/`. Questo riepilogo le nomina.

## Le migrazioni che nomina

| versione | file | commit |
|---|---|---|
| `20261025000050` | `la_bozza_sa_se_e_una_preparazione` | `b38ef5d` |
| `20261025000051` | `l_archivio_delle_ricette` | `b38ef5d` |

Il loro numero era 040/041. Sono state rinumerate prima di qualunque applicazione perché la `20261025000041` di MEMO (#207) era già sul progetto di prova: col numero vecchio la nostra sarebbe risultata «già applicata» e non sarebbe mai girata. `versioniDoppie()` l'avrebbe fermata comunque, ma solo dopo l'unione.

In parole semplici:
- **…050**: la bozza dice se è un piatto finito, una preparazione o un finger. Preparazione e finger pretendono la resa, perché il Ricettario li costa per unità di resa. Il predefinito `piatto_finito` descrive quello che la promozione faceva già, fisso, per ogni bozza.
- **…051**: bozze e ricette ricevono tag, stagioni e allergeni d'archivio, con la loro origine (`proposti` / `confermati`). `crea_bozza_da_lettura` e `promuovi_bozza_ricetta` li portano, e le chiavi nuove del jsonb sono facoltative. Nasce la vista `ricette_da_collegare`, una riga per ricetta, perché un elenco per riga d'ingrediente urterebbe il tetto delle mille righe.

## Compatibilità col codice in produzione

Le firme delle due funzioni non cambiano, e le colonne nuove sono annullabili o hanno un predefinito. Il codice oggi su master non legge niente di nuovo. L'unica riga di codice entrata col primo rilascio è la voce di `SPECCHIATI` per `bozze_ricetta.tipo`, con `daVersione: "20261025000050"`, che resta muta finché la migrazione non è applicata.

## Cosa è stato verificato, e come

- **Progetto di prova** (26/10, dal computer di Alessio, `npm run prova:migra` su `b38ef5d`): 436 → 438. I due blocchi di verifica dicono «Provato e annullato: zero residui». Dopo l'applicazione: `ricette_da_collegare` 0 righe, `recipes` con `allergeni_archivio` 0.
- **Controlli**: #227 verde su `b38ef5d`. #228 verde su `a6a6e84`, cioè codice, prove pure, prove visive, prove contro la prova e i due cancelli. Il giro su `slave` (run 40287073566) ha pubblicato su Borgo58-Prova.
- `b38ef5d` è antenato di `origin/master` (`git merge-base --is-ancestor`, 26/10).

## Cosa NON è verificato

- I numeri dopo l'applicazione in produzione non ci sono ancora: questo riepilogo è scritto **prima**, per far passare il controllo. Le righe di `applied_migrations`, i conteggi della vista e delle colonne nuove e le lapidi prima e dopo si riportano ad Alessio a lavoro fatto.
- Nessuna schermata usa ancora le colonne nuove: arriva tutto col secondo rilascio.

## Diventato falso mentre si lavorava

- La proposta #227 diceva «dopo l'unione si fa slave → master». Il primo tentativo (#229, testa `master`) non poteva passare: la regola «ramo aggiornato» di slave chiede che la testa contenga slave. Il rientro è passato da #230, cioè un merge di master sopra slave su un ramo provvisorio.
- Il primo «Cancello della filiera» di #228 era rosso finché `a6a6e84` non era uscito su Borgo58-Prova. Rilanciato dopo la pubblicazione, è diventato verde.

## Cosa abbiamo rovesciato

Niente in questo rilascio. Le migrazioni preparano due rovesciamenti, che però entrano col **secondo rilascio** insieme alle loro righe in `docs/decisioni_rovesciate.md`:
- **n. 107**: la ricetta si apre da leggere;
- **n. 108**: gli allergeni d'archivio li propone MEMO.

Nessuna decisione cambia finché il codice non le usa.
