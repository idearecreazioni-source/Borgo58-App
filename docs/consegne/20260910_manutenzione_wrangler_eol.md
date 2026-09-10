# Manutenzione: wrangler, sharp e i fine riga delle funzioni — 10/09/2026

Due piani autorizzati da Alessio il 10/09/2026 dopo l'unione della #54.

**Commit sotto questo riepilogo**: `e1f930e`, ramo `manutenzione-wrangler-eol`,
da master `df08d22`.
**Migrazioni**: nessuna. **Funzioni online**: nessuna installata, né sulla
prova né in produzione. **Produzione**: non toccata. **Chiamate al modello**:
nessuna.

---

## Piano 1 — le sessioni storiche dei due utenti di prova (fatto, fuori da questa proposta)

Eseguito solo sul progetto di prova (`bnwqgpuyzmzujxfbtyvs`), in una
transazione, dopo aver verificato che nessuna prova girasse (0 giri GitHub in
corso o in coda, 0 processi di prova su questo computer). Tolte le sole
sessioni più vecchie di un'ora di `test-titolare@` e `test-staff@`; i token di
rinnovo e le voci della doppia verifica se ne vanno a cascata (vincoli del
database, `on delete cascade`).

| utente | sessioni | token di rinnovo | voci doppia verifica |
|---|---|---|---|
| test-titolare@ | 8.338 → **0** | 8.339 → **0** | 8.338 → **0** |
| test-staff@ | 4.715 → **0** | 4.715 → **0** | 4.715 → **0** |
| alessio@ | 15 → 15 | 31 → 31 | 15 → 15 |
| staff@ | 0 → 0 | 0 → 0 | 0 → 0 |

La transazione si sarebbe annullata da sola se fossero rimaste sessioni
vecchie ai due utenti, se fossero cambiati i conteggi di un altro utente, o se
fossero rimasti token senza sessione. Dal 10/09 (#54) le prove chiudono le
sessioni che aprono, quindi non se ne riaccumulano.

## Piano 2 — questa proposta

### wrangler 4.128.0 → 4.131.0, e con lui sharp 0.35.2 → 0.35.4

- La segnalazione di sicurezza di GitHub (gravità alta, vulnerabilità di
  `libheif` in `sharp` < 0.35.4) riguarda una dipendenza di **sviluppo e
  indiretta**: `wrangler → miniflare → sharp`. Nessun'altra strada la porta.
- `wrangler 4.131.0` porta `miniflare 5.20260910.0-alpha`, che chiede `sharp
  0.35.4`. Misurato dopo l'aggiornamento: `npm ls sharp` → solo `0.35.4`;
  fra le dipendenze principali è cambiato solo `wrangler`; `npx wrangler
  --version` → 4.131.0.
- Resta bloccato a una versione esatta, come prima. Nessun altro file del
  progetto nominava `4.128`.
- ⚠️ **Lo strumento di pubblicazione aggiornato si vede davvero solo alla
  prossima pubblicazione**: i controlli del rilascio (`rilascio.mjs
  --controlla` e `--controlla-pacchetto`) lo verificano in quel momento.

### `supabase/functions/** text eol=lf`

- La causa, misurata nel mandato di stabilizzazione: `operazioni-atomiche`
  aveva lo stesso codice sulla prova e in produzione ma impronte diverse,
  perché la produzione era stata installata da una copia su Windows (fine riga
  Windows, 428 CR in più).
- I 16 file delle funzioni sono già salvati con fine riga di Linux: la regola
  non cambia nessun contenuto nel repository (`git add --renormalize` → 0
  file). Sulle copie di lavoro su Windows escono adesso con fine riga di Linux
  (prima 16 su 16 CRLF, dopo 16 su 16 LF).
- ⚠️ Alla prossima installazione, l'impronta di una funzione in produzione
  cambierà anche a codice uguale: è atteso, e da lì in poi coinciderà con
  quella della prova.

## Controlli

- **lint**: pulito · **compilazione**: riuscita.
- **prove pure**: 1.295 verdi; le 2 rosse (`indice-richieste`, `indice-rovesciamenti`) sono i fine riga di questa macchina, identiche su master, verdi su GitHub.
- **schermate**: 130 su 132; le 2 rosse sono `varco-pubblico`, e falliscono **identiche su master** (`f4b5748`, stesso contenuto di `df08d22`), rilanciate da sole: tempo scaduto a 5 s e poi due elementi uguali nella pagina. Difetto preesistente di questa macchina, verde su GitHub.
- **revisione Codex**: nessun problema (nessun file dipende dalla versione di wrangler; il file delle dipendenze cambia solo nella catena di wrangler; nessuno dei 16 file delle funzioni soffre il fine riga di Linux).
- **nessun altro file** del progetto nominava `4.128`.

## Cosa non è verificato con gli occhi

- Una pubblicazione vera con `wrangler 4.131.0`: non fatta, per mandato.

## Affermazioni diventate false mentre si lavorava

Nessuna.

## Cosa abbiamo rovesciato

Niente.
