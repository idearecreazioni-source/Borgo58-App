# L'indirizzo delle funzioni nel Vault

**29/09/2026** · mandato M16-q · ramo `claude/indirizzo-funzioni-vault` ·
migrazione `20260929000001` **scritta, NON applicata** né su Prova né in
produzione.

---

## Perché

La `20260917000001` si rifiuta di partire se nel Vault manca `url_funzioni`.
In produzione quella voce **non c'è** (dichiarato nel mandato M16-p come
misurato a mano; da qui non è misurabile, perché il ruolo di sola lettura non
può decifrare il Vault),
e nessuna migrazione l'ha mai creata: su Prova era stata messa a mano. Scriverla
a mano in produzione sarebbe «SQL improvvisato» (CLAUDE.md §2, punto 4), ed è
stato bloccato anche dal sistema di permessi della sessione (mandato M16-o).

Questa migrazione la crea **come file del repository**, che passa prima da
Prova.

## Cosa cambia

| File | Che cosa |
|---|---|
| `supabase/migrations/20260929000001_l_indirizzo_delle_funzioni_nel_vault.sql` | nuova migrazione, un solo blocco più la registrazione |
| `tests/unita/indirizzo-funzioni-vault.test.js` | 11 prove sul testo della migrazione e sulla chiave finta |
| `scripts/ricostruzione-verifica.mjs` | la sola `chiave_anon` finta diventa un JWT per forma, col solo `ref` di Prova |
| `docs/consegne/20260928_piano_pre-produzione_16_migrazioni.md` | 17 mancanti, 16 applicabili, il passaggio a parte |
| questo file | il riepilogo |

## Come funziona la migrazione

1. Legge `chiave_anon` dal Vault: deve esserci **una e una sola** volta.
2. La chiave deve avere la forma di un JWT (tre parti); il contenuto si decodifica
   e deve essere un oggetto con il campo `ref`.
3. Il `ref` deve essere uno dei **due** progetti del locale (gestionale vero o
   Borgo58-Prova). Qualunque altro caso si ferma.
4. Costruisce l'indirizzo atteso `https://<ref>.supabase.co/functions/v1`.
5. Conta le voci `url_funzioni`:
   - **nessuna** → la crea con `vault.create_secret`, col solo valore previsto;
   - **una uguale** (spazi ai bordi e barra finale non contano) → non scrive;
   - **una diversa, o più d'una** → si ferma, **senza correggere**.
6. Riverifica che resti una sola voce, uguale all'indirizzo atteso.
7. Si registra in `applied_migrations`, come ultima istruzione, nel formato
   di tutte le altre (`on conflict (version) do nothing`, che non sovrascrive).

**Come si ferma senza scrivere**: ogni rifiuto è un `raise exception` *prima*
di `vault.create_secret`, e `npm run migra` / `npm run prova:migra` applicano il
file in un'unica transazione (`--single-transaction`, verificato da
`argomentiMigrazione()` nella prova). Un errore in qualunque punto lascia il
database com'era, e la versione non si registra.

**Cosa non fa mai**: `vault.update_secret`, cancellazioni, `ON CONFLICT` sul
Vault, funzioni nuove, permessi, gestione della transazione nel file. Nessun
messaggio contiene la chiave, l'indirizzo o il riferimento letto.

## La chiave finta della ricostruzione

`scripts/ricostruzione-verifica.mjs` seminava `chiave_anon` come
`chiave-finta-della-prova-di-ricarica`, che non è un JWT: la migrazione nuova
lì si sarebbe fermata. Ora è
`eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyZWYiOiJibndxZ3B1eXptenVqeGZidHl2cyJ9.firma-finta-della-prova-di-ricarica`:
intestazione `{"alg":"none","typ":"JWT"}`, contenuto `{"ref":"<Prova>"}` e
nient'altro, firma dichiaratamente finta. Non apre niente e non è la chiave di
nessun progetto.

## Prove

- `tests/unita/indirizzo-funzioni-vault.test.js`, 11 su 11. Controllano:
  versione e nome; registrazione per ultima, dopo guardie e scrittura; i soli
  due riferimenti accettati; gli stop per chiave assente, doppia, non JWT,
  illeggibile, non oggetto; l'assenza di sovrascritture e cancellazioni; il
  confronto normalizzato prima e dopo; niente funzioni, permessi o
  transazioni; nessun argomento nei messaggi; la chiave finta.
- **Rotture provate**, una per volta e poi rimesse com'erano: un terzo
  riferimento ammesso, un valore nel messaggio, una `update_secret` → tutte e
  tre fanno fallire la prova.

## Cosa non è verificato

- **Il SQL non è mai stato eseguito**: nessun database, locale o remoto, in
  questo mandato. La prima esecuzione sarà su Prova, con un mandato apposito.
- **La `chiave_anon` nel Vault di produzione**: presenza e formato non sono
  misurabili dal ruolo di sola lettura. Se manca o non è un JWT del gestionale
  vero, la migrazione si ferma senza scrivere.
- **Una ricostruzione da zero in ordine di numero** incontra la
  `20260917000001` *prima* di questa, quando `url_funzioni` non c'è ancora:
  quella si ferma sulla sua guardia. È un limite di questa strada (numero non
  retrodatato), non misurato in esecuzione.

## Cosa abbiamo rovesciato

Niente.
