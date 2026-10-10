# Un promemoria è inviato solo se arriva, e una volta sola

**Riepilogo arretrato**, scritto il 28/09/2026 per una migrazione del 17/09/2026
· migrazione `20260917000001` · **nel codice di `master` e di `slave`, NON
applicata in produzione** · nessuna promozione è stata fatta scrivendo questo
file.

---

## Perché esiste questo riepilogo

La migrazione `20260917000001_un_promemoria_e_inviato_solo_se_arriva.sql` è
entrata in `master` il 17/09/2026 con tre commit — `887a5e4`, `4b356dd`,
`ef6cfc8` — e **nessun file di `docs/consegne/` la nominava**. L'ha trovato
l'audit in sola lettura del 28/09 (mandato M14): in produzione le migrazioni
registrate sono 394, l'ultima è del 16/09, e questa non c'è.

⚠️ **Questo file non racconta un'applicazione**: non ce n'è stata nessuna. Non
contiene quindi i numeri veri che un riepilogo di consegna porta dopo aver
applicato. Quei numeri andranno scritti nel riepilogo del rilascio, quando e se
la migrazione entrerà in produzione.

⚠️ **Conseguenza sulla rete dei riepiloghi, dichiarata**: `npm run migra` e
`npm run consegne` considerano «documentata» una versione che compare per
intero in un file di `docs/consegne/`. Da questo commit in poi la `…0917`
**risulta già nominata**, quindi dopo l'applicazione la rete **non chiederà
più da sola** un riepilogo per lei. Il riepilogo col risultato vero resta
dovuto per regola (CLAUDE.md §2) — ma lo tiene in piedi la disciplina, non la
rete. È il prezzo di aver chiesto questo documento prima dell'applicazione.

## Cosa corregge

`send_due_task_reminders` — il giro che manda i promemoria dell'Agenda su
Telegram — aveva quattro difetti, nessuno dei quali dava un errore:

1. **l'indirizzo della produzione era scritto fisso** dentro la funzione;
2. **«inviato» voleva dire «accodato»**: il numero della richiesta di `pg_net`
   veniva buttato via e `reminder_sent_at` si scriveva subito, quindi un
   promemoria mai arrivato risultava mandato e non veniva più ritentato;
3. **l'esito non lo registrava niente**: `net._http_response` non era letta;
4. la prima stesura della correzione toglieva il falso «inviato» ma **non
   impediva il doppione** — ed è il motivo per cui il file fu riscritto prima
   di essere applicato in qualunque posto.

## Cosa crea e cosa cambia

| Oggetto | Che cosa |
|---|---|
| `invii_promemoria` (tabella nuova, RLS titolare) | un tentativo di invio e com'è finito: `in_volo`, `riuscito`, `fallito`, `senza_risposta`, `esito_ignoto` |
| `invii_promemoria_una_in_volo` (indice unico parziale) | il possesso di una consegna si prende scrivendo, prima di accodare: due giri sovrapposti non accodano due volte |
| `invii_promemoria_per_chiave`, `invii_promemoria_per_task` | indici su una tabella nuova, quindi vuota |
| `consegne_telegram` (tabella nuova, RLS titolare) | che cosa la funzione online ha già consegnato, per chiave |
| `url_delle_funzioni()` | l'indirizzo delle funzioni online di QUESTO database, dal Vault; **senza ripiego** |
| `chiave_di_consegna(uuid, timestamptz)` | la chiave `promemoria:<impegno>:<quando avvisare>`, stabile fra i tentativi |
| `prendi_consegna`, `conferma_consegna`, `rilascia_consegna`, `consegna_presa_scaduta` | le chiamate della funzione online; eseguibili solo con la chiave di servizio |
| `esito_di_un_invio(integer, text, text)` | decide l'esito dal **corpo** della risposta, non dal codice: la funzione online risponde 200 sia quando manda sia quando salta |
| `send_due_task_reminders()` | riscritta: niente indirizzo fisso, possesso prima della richiesta, chiave con ogni richiesta |
| `raccogli_esiti_promemoria()` | legge le risposte di `pg_net` e chiude i tentativi |
| lavoro pianificato `esiti-promemoria` | ogni 5 minuti, con la sua riga in `lavori_sorvegliati` (tolleranza 30 minuti) e il battito di partenza in `stato_lavori` |

Si applica in **un'unica transazione** (`npm run migra` usa
`--single-transaction` perché il file non contiene `alter type … add value`).

## Le tre guardie iniziali

La migrazione si rifiuta, prima di cambiare qualunque cosa, se:

1. il corpo vivo di `send_due_task_reminders` non è quello che si aspetta di
   sostituire (deve contenere l'indirizzo fisso e `reminder_sent_at = now()`,
   e non deve conoscere già `invii_promemoria`);
2. in `net._http_response` manca una delle colonne `id`, `status_code`,
   `content`, `error_msg`, `created`;
3. nel Vault manca il segreto `url_funzioni`.

**Misurato in produzione il 28/09, in sola lettura** (sessione `READ ONLY`,
nessun segreto letto): le condizioni 1 e 2 sono soddisfatte. **La condizione 3
non è stata misurata**, perché richiede di interrogare il Vault: se manca, la
migrazione si ferma prima di toccare qualunque cosa.

## 🔴 La regola dell'ordine: funzione prima, migrazione dopo

Scritta nel file della migrazione e nel commit `ef6cfc8`, ed è l'unico ordine
in cui nessuna delle due metà trova l'altra impreparata:

1. **prima** si installa `notify-telegram-reservation`. Il database è ancora
   quello vecchio e non manda nessuna chiave, quindi la funzione nuova prende la
   strada diretta e si comporta come prima;
2. **poi** si applica questa migrazione: da quel momento il database manda la
   chiave con ogni richiesta, e la deduplicazione entra in funzione da sé.

⚠️ **Al contrario il guasto è muto**: con la migrazione applicata e la funzione
ancora vecchia, il database manderebbe una chiave che nessuno legge — nessun
errore, e il doppione tornerebbe possibile.

Letto nel codice di `slave` il 28/09: la funzione deduplica **solo** se la
richiesta porta `chiave_consegna` (`consegna.ts`), e fuori da Prova non chiama
nessuna funzione del silenzio (`silenzio.ts`). Quale versione della funzione sia
installata oggi in produzione **non è stato misurato**.

## Cosa NON è stato applicato

- **In produzione: niente.** Misurato il 28/09: `invii_promemoria` e
  `consegne_telegram` non esistono, e la versione non è registrata.
- Il lavoro `esiti-promemoria` non esiste in produzione: **non misurato**
  (`cron.job` non è stato interrogato).
- Su Borgo58-Prova lo stato di questa migrazione **non è stato verificato** in
  questo lavoro: il mandato vietava di interrogare Prova a mano.

## Cosa non è verificato

- la presenza di `url_funzioni` nel Vault di produzione;
- la versione di `notify-telegram-reservation` installata in produzione;
- il comportamento dal vivo di `raccogli_esiti_promemoria` in produzione.

## Cosa abbiamo rovesciato

Niente. Questo file documenta una migrazione scritta il 17/09 e non ne cambia
nessuna decisione.
