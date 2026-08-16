# Consegna del 16/08/2026 (quattordicesima) — la prima delle piccolezze

**Commit della consegna: `ff34aaa`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `1b17caf` | il food cost medio del menu: media sui piatti, e il limite scritto accanto |
| `ff34aaa` | l'ultima porta aperta per difetto — migrazione `20260816000014` |

⚠️ **`20260816000014` è già applicata in produzione** (§4). Nessuna
operazione nuova nel corridoio, nessuna Edge Function reinstallata.

Questa consegna **non modifica** `docs/CONTRATTO.md`.

Sono le prime due delle **piccolezze** in coda al mandato di correzione.
Le altre non sono state iniziate: l'elenco di ciò che resta è in §6.

---

## 1. Il food cost medio del menu

Era una **media delle medie per categoria**: ogni categoria pesava
uguale, e con due dolci e dodici primi i dolci — quasi sempre pochi e
cari — spostavano il numero come se fossero metà del menu.

**I tre numeri possibili, e quale è stato scelto:**

| Numero | Stato |
|---|---|
| Media delle medie per categoria | quello di prima |
| **Media su tutti i piatti** | **quello di adesso** — l'unico calcolabile oggi |
| Food cost pesato su quanto si vende | l'unico che serve a decidere i prezzi; richiede gli scontrini veri |

⚠️ **Il limite viaggia col numero.** Sotto la percentuale c'è scritto:
*«Media su tutti i piatti del menu, non pesata su quanto si vende: un
piatto che esce due volte a sera conta come uno che esce venti.»* Senza
quella riga, fra un anno il numero verrebbe letto come se fosse il terzo —
la solita forma, una promessa scritta in un posto e non mantenuta in un
altro. Il terzo numero è **lavoro da chiedere, non da dedurre**.

**Fatto adesso e non più avanti** (decisione di Alessio su indicazione del
validatore): oggi quel numero non guida nessuna decisione, quindi
cambiarlo non costa niente; quando ci saranno i piatti veri servirà a
decidere i prezzi, e quello sarebbe il momento peggiore.

**Trovato correggendo:** se **nessun** piatto ha un prezzo, i due numeri
venivano calcolati lo stesso sulle categorie presenti — cioè costruiti sul
niente. Ora mostrano un trattino. È lo zero al posto del buco, travestito
da percentuale.

---

## 2. L'ultima porta aperta per difetto

`abbina_righe_carico` **non ha mai avuto nessun `revoke`**: i suoi
permessi erano quelli **predefiniti di Postgres**, che concedono
l'esecuzione a `public` — e quindi ad `anon`, cioè a chiunque abbia la
chiave pubblica che sta nel bundle del sito. Era l'ultima rimasta dello
stato congelato del 13/08, dove il commento la segnalava già come «merita
un giro suo».

**Controllato prima di togliere, non dopo** (richiesta del validatore: una
revoca su qualcosa che serve rompe in silenzio invece di chiudere un
buco). Letto col connettore:

| Chi la usa | Esito |
|---|---|
| Altre funzioni di `public` che la nominano | **nessuna** |
| Schermate del sito (`rpc(`) | **nessuna** |
| Trigger | **`trg_abbina_righe_carico` su `posta_azioni`** — l'unico |

Una funzione di trigger **non ha bisogno del permesso di esecuzione**
perché il trigger scatti: lo esegue il motore per conto della tabella.

⚠️ **La verifica non si limita a controllare che la porta sia chiusa:
controlla che il trigger sia ancora attaccato e acceso.** «Non dovrebbe
cambiare niente» non è una verifica, ed è precisamente la frase da cui
nascono i guasti silenziosi.

---

## 3. L'elenco congelato scende da 12 a 11

È l'unico modo ammesso di far cambiare quel numero: **una riga in meno,
dichiarata nella stessa consegna**. `tests/app/permessi.test.js` è
aggiornata col perché scritto dentro il file, non solo qui.

Se quel numero cambiasse senza che nessuno lo dica, sarebbe il difetto del
12/08 — ed è il motivo per cui quella prova esiste.

---

## 4. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 121
aperte_alla_chiave_pubblica: 11 | senza_permessi_dichiarati: 9
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Funzioni di `public` eseguibili col solo `anon` | **11** (erano 12) |
| `abbina_righe_carico` eseguibile da `anon` | **no** |
| Trigger `trg_abbina_righe_carico` | **acceso** (`O`) |

⚠️ **`senza_permessi_dichiarati: 9`** — restano nove funzioni di `public`
con `proacl` nullo, cioè coi permessi predefiniti. Non sono un buco
equivalente: le funzioni di trigger e quelle non `security definer` non
espongono niente a chi le chiamasse. Ma è un numero che vale la pena
guardare in un giro dedicato, e viene dichiarato qui invece di restare
implicito nel risultato.

---

## 5. Cosa NON è verificato

- **Il carico da fattura non è stato riesercitato** dopo la revoca: il
  trigger è acceso e non ha bisogno di permessi, ma nessuna mail con
  fattura è passata dalla posta oggi. La prova è quella dentro la
  migrazione, non un giro vero.
- **Il food cost medio non è mai stato guardato con dei piatti**: il
  Ricettario è vuoto (0 ricette, 0 menu), quindi oggi quella schermata
  mostra un trattino — che è il comportamento nuovo, e l'unico
  osservabile.
- **Le nove funzioni coi permessi predefiniti non sono state esaminate
  una per una.**

---

## 6. Le piccolezze che restano

Non iniziate. L'elenco è il punto di partenza della sessione successiva:

| Cosa | Nota |
|---|---|
| «Da pagare» delle fatture | **due totali separati**, uno per società — cura già decisa dal validatore |
| Elenco previsioni | **filtro per società**, come fa già *Come sta andando* — cura già decisa |
| Importi in Archivio Documenti | ⚠️ **da guardare prima di scegliere**: se somma documenti di natura diversa (una fattura, un contratto, una visura) non significa niente nemmeno separato per società, e la cura è **toglierlo** lasciando gli importi sulle righe |
| Ricerche che si rompono con una virgola | archivio documenti, prenotazioni, clienti |
| `deleteCompletedTasks` | non chiamata da nessuna schermata, e il commento descrive un pulsante che non esiste |
| Parametro «azione» del ricevimento merci | accettato dall'api, mai usato dalla schermata |
| Elenchi che crescono per sempre | «pagate di recente»; la ricerca dell'archivio che parte a ogni tasto |
| Categorie della carta bevande | testo libero: «Rossi» e «rossi» diventano due sezioni |
| Altro dal mandato | mance oltre il monte avvisate ma non impedite; «dividi equamente» che lascia i centesimi; coltura a «raccolto» senza quantità; policy delle 5 tabelle nuove scritte per `public` invece che `authenticated` |

**La regola per quella sessione**, confermata da Alessio: se una
piccolezza cambia un numero che lui guarderà, ci si ferma e si chiede
prima — come è stato fatto per il food cost e per i totali delle due
società.
