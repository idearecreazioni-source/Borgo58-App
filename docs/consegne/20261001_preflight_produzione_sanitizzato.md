# Il preflight sanitizzato — cosa deve essere vero prima della produzione

**01/10/2026** · mandato M21-D · ramo `claude/preflight-produzione-sanitizzato` ·
base `slave` `1f00f0e` · **nessuna migrazione**, nessun database letto, niente
applicato su Prova né in produzione.

> 🔴 **Questo NON è uno strumento che si collega alla produzione.** Non legge
> database, Vault, `.env` o segreti. Riceve risposte già preparate da qualcun
> altro e decide soltanto: **PRONTO** o **NON PRONTO**.

Tre file, che una prova tiene d'accordo:

- questo documento;
- `scripts/preflight-produzione-sanitizzato.mjs`, il modulo che decide, senza
  nessuna importazione;
- `tests/unita/preflight-produzione-sanitizzato.test.js`, la prova.

Il piano a cui si riferisce è il contratto già unito,
`20261001_contratto_preflight_rilascio_17_migrazioni.md`.

---

## A cosa serve

Prima di applicare le 17 migrazioni in produzione vanno fatte una dozzina di
verifiche sull'ambiente vero. Le farà, in un mandato futuro, un **esecutore
protetto**. Questo modulo fissa adesso **quali risposte dovrà dare e in che
forma**, così le regole per dire «si parte» sono scritte prima di vedere i
risultati, e non dopo.

## Le sole informazioni che l'esecutore potrà passare

Solo tre tipi di dato:

- **sì / no** (vero o falso);
- **numeri interi** (quante righe, quante voci);
- **numeri di versione** delle migrazioni, di 14 cifre.

**Mai testo libero, mai valori del Vault, mai indirizzi, mai chiavi.** Se arriva
qualunque altra cosa — una frase, un indirizzo, un campo che il modulo non
conosce — il risultato è **NON PRONTO**. Il modulo dice **quale campo** era
sbagliato, ma **non ripete mai cosa conteneva**. Dei campi sconosciuti dice
solo **quanti** sono, perché anche un nome potrebbe essere un dato da non
mostrare.

## I 12 controlli

Per ognuno il risultato è soltanto **OK**, **NON OK** o **NON VERIFICATO**.

| # | Controllo | È OK quando |
|---|---|---|
| 1 | `master` contiene tutte e 17 le versioni | le 17 ci sono tutte |
| 2 | Prova registra tutte e 17 | le 17 ci sono tutte |
| 3 | la produzione è ferma esattamente prima del rilascio | l'ultima registrata è la `20260916000002`, mancano esattamente le 17, e nessuna registrata è estranea al repository |
| 4 | copia di sicurezza recente | confermata |
| 5 | `chiave_anon` | c'è una volta sola ed è del progetto atteso — **senza riportarne il valore** |
| 6 | `url_funzioni` | assente (la crea il primo giro), oppure presente una volta sola e corrispondente — **senza riportarne il valore** |
| 7 | funzione online delle notifiche | installata prima del secondo giro |
| 8 | guardie, dati e corpi vivi | tutti e tre confermati |
| 9 | transazioni e blocchi | zero transazioni lunghe, zero blocchi incompatibili |
| 10 | primo giro | è la sola `20260929000001` |
| 11 | secondo giro | sono le 15 applicabili, in ordine di numero |
| 12 | la `20260921000001` | è esclusa, e la registra la `20260921000002` |

Il secondo giro, per intero: `20260917000001`, `20260919000001`,
`20260920000001`, `20260920000002`, `20260920000003`, `20260920000004`,
`20260920000005`, `20260921000002`, `20260921000003`, `20260922000001`,
`20260923000001`, `20260923000002`, `20260923000003`, `20260923000004`,
`20260928000001`.

## Quando il rilascio è PRONTO

**Solo se tutti e 12 i controlli sono OK** e l'ingresso è stato accettato per
intero.

## Quando il rilascio è NON PRONTO

Basta una di queste:

- un controllo **NON OK**;
- un controllo **NON VERIFICATO** — una risposta mancante non vale come «sì»;
- un campo che il modulo non conosce;
- un valore del tipo sbagliato, per esempio una frase al posto di un sì/no.

**E anche PRONTO non è un'autorizzazione**: dice solo che le condizioni sono
vere. Il rilascio richiede comunque un mandato esplicito.

## I segreti

- Non vanno **mai** letti per riportarli, stampati o inclusi in un risultato.
- L'esecutore futuro deve **trasformarli in un sì/no o in un conteggio** prima
  di passarli qui: per esempio «la chiave c'è una volta sola» e non la chiave.
- Né il modulo né questo documento contengono valori del Vault, indirizzi o
  chiavi, e la prova lo controlla.

## Il prossimo preflight reale

Dovrà restituire **soltanto** l'oggetto previsto dal modulo, con i 20 campi
elencati in `CAMPI`. Se ne restituisce di più, o in un'altra forma, il
risultato è NON PRONTO per costruzione.

## La prova

`tests/unita/preflight-produzione-sanitizzato.test.js` controlla:

- che ci siano tutti e 12 i controlli obbligatori;
- tutti OK → PRONTO;
- un solo NON OK → NON PRONTO;
- un solo NON VERIFICATO → NON PRONTO;
- testo libero, valori del tipo sbagliato e proprietà inattese → rifiutati, e
  il valore ricevuto non compare mai nel risultato;
- che il modulo non abbia importazioni, ambiente, rete, database, SQL, file,
  indirizzi o segreti;
- che modulo, documento e contratto delle 17 migrazioni dicano le stesse
  versioni, lo stesso primo giro, lo stesso secondo giro e la stessa esclusa.

## Cosa non è verificato

- Nessuno dei 12 controlli è stato fatto sull'ambiente vero: è il compito del
  prossimo mandato.
- Che la produzione sia ancora ferma alla `20260916000002`: lo era all'audit
  M21-A del 01/10/2026.

## Cosa abbiamo rovesciato

Niente.
