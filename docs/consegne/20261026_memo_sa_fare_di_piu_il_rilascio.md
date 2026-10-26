# MEMO sa fare di più — il riepilogo del rilascio in produzione

**26/10/2026** · riepilogo di sola documentazione · commit sotto questo riepilogo: `a1046f0` (master dopo l'unione di #218, «Rilascio: quaderno dei difetti, MEMO voce, misure spagnole») · ramo `claude/project-thread-xz94pz`, proposta verso `slave`

## Perché esiste questo riepilogo

Il 26/10 alle 03:08 UTC Alessio ha detto di portare in produzione le novità di MEMO. `npm run migra`, lanciato in sola lettura dal suo computer su un worktree a `a1046f0`, si è fermato:

```
migrazioni nel repository: 436
gia' applicate in produzione: 429
copia di sicurezza: 2026-10-25_1614 (11.9 ore fa)
FERMO: queste migrazioni stanno per entrare in produzione e nessun riepilogo le nomina.
```

Il controllo ha fatto il suo lavoro. Il lavoro di queste sei migrazioni era stato consegnato con le proposte, ma nessun file di `docs/consegne/` scriveva la loro versione per intero. Questo riepilogo le nomina. Il racconto tecnico di ciascuna sta nel commento in testa al suo file.

## Le migrazioni che nomina

| versione | file | commit |
|---|---|---|
| `20261025000003` | `memo_ricorda_gli_ultimi_minuti` | `1270a40` |
| `20261025000004` | `una_correzione_prende_il_posto` | `502fca5` |
| `20261025000005` | `lo_stesso_prodotto_non_si_segna_due_volte` | `001a20f` |
| `20261025000041` | `un_prestito_si_detta` | `398912a`, `297b32b` |
| `20261025000042` | `memo_impara_le_operazioni_dal_database` | `eadd70d`, `166d605` |
| `20261025000043` | `le_operazioni_di_memo_dichiarate_alle_reti` | `c0250fd` |

`20261025000002` (il quaderno dei difetti) era già nominata in [`20261025_il_quaderno_dei_difetti.md`](20261025_il_quaderno_dei_difetti.md).

In parole semplici:
- MEMO ricorda le frasi degli ultimi minuti e chiede quando non ha capito.
- Una correzione detta a voce prende il posto della riga di prima.
- Lo stesso prodotto detto due volte nella stessa lista non si segna due volte.
- I prestiti si dettano e finiscono in Cassa → Prestiti, dopo il sì.
- Prenotazione, caparra, mance, nota di credito e uscita prevista si dettano. Usano le stesse operazioni dei pulsanti. L'anteprima la scrive il gestionale e niente parte senza il sì. I gesti che non si annullano (eliminare, chiudere un conto, pagare) restano solo sui pulsanti.
- La 0043 dichiara le operazioni nuove alle due reti (portieri e rami). La 0042 era già applicata sulla prova, quindi non è stata riscritta.

## Cosa è stato verificato, e come

- Tutti i commit della tabella sono antenati di `origin/master` (`git merge-base --is-ancestor`, 26/10).
- Il giro «Controlli» su `slave` al commit `6b05a30` (run 40249545378): codice, prove pure e compilazione verdi, prove visive verdi, **prove contro il progetto di prova verdi**, pubblicazione su Borgo58-Prova riuscita. I due «Cancello della filiera» su #218 sono verdi.
- Il conteggio 436 / 429 e la copia di sicurezza sono quelli stampati da `npm run migra` il 26/10. La differenza è 7, cioè le sei qui sopra più la `…002`.

## Cosa NON è verificato

- Che le sette siano registrate sul progetto di prova lo controlla `npm run migra` stesso, come condizione per applicare. Da questa sessione non l'ho letto a parte.
- I numeri dopo l'applicazione non ci sono ancora: il riepilogo è scritto **prima**, per far passare il controllo. Le righe di `applied_migrations` e il conteggio di `deleted_records`, prima e dopo, si riportano ad Alessio in chat a lavoro fatto.

## Diventato falso mentre si lavorava

Niente.

## Cosa abbiamo rovesciato

Niente. Questo riepilogo non cambia codice né decisioni.
