# Le ricette da un link, e il ricettario virtuale

**10/10/2026.** Riepilogo per il validatore.

⚠️ **Scritto PRIMA di applicare in produzione**, perché `npm run migra` lo
pretende («nessun riepilogo le nomina»). I numeri veri dell'applicazione si
aggiungono in fondo, alla voce § 6, dopo `--conferma`.

---

* **HEAD della consegna su `master`**: `1361f43` (merge della #166, slave →
  master), che contiene le proposte #165, #168, #169, #170, #171, #172.
* **Ramo di questo documento**: `claude/align-prod-staging-data-zym1ue`.
  **Solo documentazione.**
* **Working tree**: pulito dopo questo commit.

## Migrazioni (versioni per intero)

| versione | cosa | Prova | Produzione |
|---|---|---|---|
| `20261006000001` | le bozze di ricetta (prima versione) | registrata dalla `20261010000001` | **da saltare**: si fermava sulla rete delle unità (`quantita_lorda` non classificata). La registra la `20261010000001` |
| `20261010000001` | le bozze di ricetta col lordo — sostituisce la `20261006000001` e la registra | applicata | da applicare |
| `20261010000002` | la bozza da un link (`crea_bozza_da_lettura`, `gesto_creazione`) | applicata | da applicare |
| `20261010000003` | l'assistente sistema la ricetta importata (`letture_ricetta`, `registra_lettura_ricetta`, `consumi_ai` + ramo `ricetta`, `bozze_ricetta.proposte_assistente`, `crea_bozza_da_lettura` con categoria e fasi) | applicata, 415 registrate | da applicare |

Comando: `npm run migra -- --salta 20261006000001 --conferma`.

## Funzioni online

* `ricetta-da-link` — nuova: legge il blocco `ld+json` Recipe di una pagina
  di `clove.kitchen` (rinvii ricontrollati, 10 s, 3 MB) e chiede al modello
  `claude-haiku-4-5-20251001` categoria, fasi e nomi puliti. Non tocca i
  numeri. Spesa registrata in `letture_ricetta`, dentro il tetto unico.
* `operazioni-atomiche` — aggiunta `crea_bozza_da_lettura`.

Installate su Prova il 10/10; in produzione da installare.

## Cosa si è visto (Prova, 10/10)

* Importata la panna cotta al mandarino da Clove: titolo, 4 porzioni,
  11 ingredienti, 9 passaggi, video; categoria «Dolce» e fasi proposte
  dall'assistente; panna convertita a 0,5 l; righe incerte senza numero.
* La scheda di lettura (`LetturaBozza.jsx`) guardata a 390 e 1280 punti su
  una pagina d'anteprima locale con quei dati: a 390 nessuno sbordo.
* **Non guardato**: la vista «Modifica»; il costo della lettura in euro
  (dal container non si legge il database di prova).

## Cosa abbiamo rovesciato

N. 97 in `docs/decisioni_rovesciate.md`: «ml» resta «ml» → si converte
(conversioni esatte); l'elenco dei buchi sempre visibile → dietro «Portala
in cucina». La ragione sui buchi **vale ancora**: la promozione a ricetta
del locale li rifiuta come prima; cambia solo quando si guardano.

## 6 · Applicazione in produzione

Applicata da Alessio il 10/10/2026 alle 23:28 circa, con
`npm run migra -- --salta 20261006000001 --conferma`: **3 su 3**. Poi
`npm run funzione ricetta-da-link -- --conferma` e
`npm run funzione operazioni-atomiche -- --conferma`, tutte e due «Fatta».

Letto dopo dal database vero (connettore in sola lettura):

* `applied_migrations`: **415** (erano 411). Nuove: `20261006000001`
  (registrata dalla `20261010000001`), `20261010000001`, `20261010000002`,
  `20261010000003`.
* `bozze_ricetta`: **0** righe; `letture_ricetta`: **0** righe — nessun dato
  creato dalle verifiche.
* `recipes`: **14**, invariate.
* Presenti `crea_bozza_da_lettura`, `registra_lettura_ricetta`, le colonne
  `bozze_ricetta.gesto_creazione` e `proposte_assistente`; `consumi_ai`
  comprende `letture_ricetta`.
* **Non verificato da qui**: che la chiave `ANTHROPIC_API_KEY` sia nei
  Secrets di produzione (si vedrà alla prima importazione: senza, la bozza
  nasce lo stesso e lo dice).
