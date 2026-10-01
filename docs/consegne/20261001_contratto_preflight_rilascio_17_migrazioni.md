# Il contratto di preflight — le 17 migrazioni che mancano in produzione

**01/10/2026** · mandato M21-C · ramo `claude/contratto-preflight-rilascio` ·
base `slave` `b60c997` · **nessuna migrazione**, niente applicato su Prova né
in produzione, nessun database letto.

> 🔴 **Questo contratto NON è un'autorizzazione a rilasciare.** Dice in che
> ordine andrebbero applicate le 17 migrazioni e cosa deve essere vero prima.
> Il rilascio vero richiede un mandato a parte, dopo le verifiche
> sull'ambiente.

Il piano è scritto due volte, e una prova le tiene d'accordo:

- in parole, qui;
- in dati, in `scripts/contratto-preflight-rilascio.mjs`, che non importa
  niente, non si collega a niente e non scrive niente.

La prova `tests/unita/contratto-preflight-rilascio.test.js` confronta le due
cose fra loro e con la cartella `supabase/migrations/`.

---

## Il punto di partenza

All'audit M21-A (01/10/2026, sola lettura) in produzione l'ultima versione
registrata era la `20260916000002`, e mancavano **17** migrazioni. A rilascio
finito devono risultare registrate tutte e 17:

`20260917000001`, `20260919000001`, `20260920000001`, `20260920000002`,
`20260920000003`, `20260920000004`, `20260920000005`, `20260921000001`,
`20260921000002`, `20260921000003`, `20260922000001`, `20260923000001`,
`20260923000002`, `20260923000003`, `20260923000004`, `20260928000001`,
`20260929000001`.

## Il piano in due giri

**Primo giro — una sola migrazione: `20260929000001`.**
Crea nel Vault la voce `url_funzioni`, solo se manca. Ne hanno bisogno la
`20260917000001` (si ferma se la voce manca) e la verifica della
`20260920000001`. Ha il numero più alto di tutte: in un giro solo verrebbe
applicata per ultima, quindi va fatta prima e da sola.

**Secondo giro — le altre 15, in ordine di numero:**

1. `20260917000001`
2. `20260919000001`
3. `20260920000001`
4. `20260920000002`
5. `20260920000003`
6. `20260920000004`
7. `20260920000005`
8. `20260921000002`
9. `20260921000003`
10. `20260922000001`
11. `20260923000001`
12. `20260923000002`
13. `20260923000003`
14. `20260923000004`
15. `20260928000001`

**La `20260921000001` non si applica mai direttamente.** La sua guardia cerca
la funzione da sostituire in una forma che la produzione non usa, quindi si
fermerebbe. E il corpo che scrive perderebbe tre cose aggiunte dopo. La
`20260921000002` porta lo stesso effetto e, **dopo** la propria verifica, la
registra. Così a fine rilascio risultano registrate tutte e 17.

**Ogni giro parte solo se il precedente è riuscito.** Se il primo si ferma, il
secondo non parte.

## Cosa è dimostrato dal codice

| Fatto | Dove si vede |
|---|---|
| La `20260917000001` si ferma se nel Vault manca `url_funzioni` | `20260917000001`, righe 169-174 |
| La `20260929000001` non usa niente di quello che creano le altre 16 | `20260929000001`, righe 63-128 |
| La `20260929000001` scrive solo se la voce manca, non sovrascrive mai | `20260929000001`, righe 96-112 |
| La verifica della `20260920000001` pretende `url_funzioni` | `20260920000001`, blocco di verifica finale |
| La guardia della `20260921000001` cerca gli argomenti nella forma `'uuid, jsonb'` | `20260921000001`, riga 111 |
| La `20260921000002` registra la `20260921000001` dopo la propria verifica | `20260921000002`, righe 558-564 |
| La `20260920000004` pretende la `20260920000002` e la `20260920000003` | `20260920000004`, righe 63-74 |
| La `20260920000005` pretende la `20260920000004` | `20260920000005`, righe 30-47 |
| La `20260923000001` deve venire dopo la `20260922000001`, che ricrea la vista senza l'opzione di sicurezza | `20260922000001`, riga 1052; `20260923000001`, riga 55 |
| La `20260923000004` pretende la `20260923000003` | `20260923000004`, riga 80 |
| Lo strumento applica le migrazioni in ordine di numero, e un ordine diverso si ottiene solo con due giri e `--salta` | `scripts/migra.mjs`, righe 76, 135-149, 228 |
| Ogni file va in una transazione sola, e nessuno dei 17 fa eccezione | `scripts/comune.mjs`, righe 382-384 |

Tutti gli altri vincoli d'ordine fra le 15 del secondo giro sono già rispettati
dall'ordine di numero.

## Cosa richiede una verifica reale

Non si può sapere dal codice. Va fatto in un **mandato separato**, in sola
lettura, **senza mai stampare valori**:

- **Vault di produzione**:
  - la chiave `chiave_anon` c'è una volta sola ed è quella del gestionale vero;
  - `url_funzioni` manca, oppure c'è ed è quella giusta.
- **Funzione online**: `notify-telegram-reservation` va installata **prima**
  della `20260917000001`.
- **Corpi vivi della produzione**: devono soddisfare le guardie della
  `20260917000001`, della `20260920000003` e della `20260921000002`.
- **Nessun'altra funzione** deve nominare il gestionale vero, oltre a quelle
  che la `20260920000001` riscrive. Altrimenti la sua verifica si ferma.
- **Dati**: le righe delle ricette devono reggere il controllo della
  `20260922000001`.
- **Prova**: le 17 versioni registrate anche lì.
- **Copia di sicurezza** recente della produzione.

## Cosa blocca il rilascio, oggi

- Su `master` mancano 16 delle 17 migrazioni, e lo strumento rifiuta tutto ciò
  che non è su `master`.
- Le verifiche reali qui sopra non sono ancora state fatte.
- Nessun mandato autorizza il rilascio.

## Quando ci si ferma

Senza correggere e senza riprovare, se:

- una condizione per partire non è vera;
- il primo giro, in sola lettura, elenca qualcosa di diverso dalla sola
  `20260929000001`;
- il primo giro si ferma: il secondo non parte;
- il secondo giro, in sola lettura, elenca un insieme o un ordine diverso dalle
  15 qui sopra;
- una guardia o una verifica di una migrazione si ferma;
- un'applicazione resta in attesa di un blocco;
- arriva un allarme durante o subito dopo.

## Cosa questo contratto non contiene

- **Nessun valore del Vault, nessun indirizzo riservato, nessuna chiave.**
- Nessun comando da eseguire: è un piano descrittivo.
- Nessuna lettura di database: tutto viene dal codice del repository e
  dall'audit M21-A già fatto.

## La prova

`tests/unita/contratto-preflight-rilascio.test.js` controlla:

- le 17 versioni esatte, senza doppioni;
- la `20260929000001` da sola nel primo giro;
- la `20260921000001` esclusa, e registrata dalla `20260921000002`;
- le 15 del secondo giro, in ordine;
- che ogni versione esista come file nella cartella delle migrazioni, e che fra
  la `20260916000002` e la `20260929000001` non ci sia nessun altro file;
- che questo documento nomini tutte e 17 per intero;
- che lo script non abbia importazioni né accessi a rete, ambiente, database o
  disco.

## Cosa non è verificato

- Tutto l'elenco «Cosa richiede una verifica reale».
- Che la produzione sia ancora ferma alla `20260916000002`: lo era all'audit
  M21-A del 01/10/2026, e va riletto prima del rilascio.

## Cosa abbiamo rovesciato

Niente. Il contratto mette in forma controllabile il piano del 28/09
(`20260928_piano_pre-produzione_16_migrazioni.md`) e l'audit M21-B, senza
cambiarne l'ordine.
