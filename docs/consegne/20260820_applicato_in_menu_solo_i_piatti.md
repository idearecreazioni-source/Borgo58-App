# Applicata: in un menu ci vanno solo i piatti

**Migrazione applicata**: `20260820000002_in_menu_solo_i_piatti` — **1 su 1**,
dopo il push di Alessio. **Nessuna funzione online toccata.**
**Autorizzazione**: sua, esplicita, con i vincoli di sempre.

---

## I numeri veri, letti dalla produzione dopo l'applicazione

| | |
|---|---|
| migrazioni | **152** (erano 151) |
| ricette | **0** |
| menu · piatti in menu · menu del giorno | **0 · 0 · 0** |
| tracce nel registro delle cancellazioni | **26** — *invariate* |
| movimenti di cassa | **0** — *invariati* |
| conti · di cui aperti | **8 · 0** — *invariati* |
| ingredienti · fornitori | **8 · 2** — *invariati* |

Le reti permanenti, tutte ferme: **16** funzioni senza portiere, **10** aperte
ad anon, **0** date a Greenwich, **0** lapidi di prova, **0** predefiniti di
data.

⚠️ **Il 16 non è diventato 17 e non è una svista**: `solo_piatti_in_menu()` è
`security definer`, ma **non è eseguibile da nessuno** — verificato in
produzione: né `authenticated` né `anon` hanno il permesso. Gira solo come
trigger, e a un trigger Postgres non chiede il permesso di esecuzione. Il
censimento conta le **porte**, e questa non è una porta.

---

## 🔴 La verifica che vale più del conteggio

Richiesta di Alessio: *«prova a far entrare in un menu una PREPARAZIONE e un
BOCCONCINO col segno pronta per la carta acceso. Devono essere rifiutati dal
database, non solo nascosti dalla schermata»*.

**Fatta in produzione**, dentro il blocco di verifica della migrazione, che si
è pulito da sé — è la sola strada ammessa per toccare dati veri. I sei
controlli sono passati:

| prova | esito in produzione |
|---|---|
| preparazione **segnata pronta** → in carta | **respinta**, e il messaggio dice «è una preparazione» |
| bocconcino **segnato pronto** → in carta | **respinto**, e il messaggio dice «è un bocconcino» |
| **piatto pronto → in carta** | **entrato** |
| bocconcino → piatti del giorno | **respinto** (seconda porta) |
| voce libera senza ricetta → piatti del giorno | **ammessa** |
| piatto in carta **sostituito** con una preparazione | **respinto** (aggiornamento, non solo inserimento) |

⚠️ **Il terzo è quello che rende gli altri leggibili**: senza, un divieto che
blocca tutto passerebbe le prove senza misurare niente. Era il rilievo di
Alessio, ed è la ragione per cui sta lì.

E i due trigger sono **attivi** in produzione su tutte e due le tabelle, su
`insert` **e** su `update`: letto dal catalogo, non dedotto.

### ⚠️ Cosa quella verifica NON prova, e dove è provato

Il blocco della migrazione gira **come proprietaria del database**, dove la RLS
non esiste: prova che il **trigger scatta**, non che scatti anche per un utente
normale. *È il buco strutturale dichiarato il 16/08.*

La parte mancante è provata **sul progetto di prova**, con il token di un
utente vero (`tests/app/in-menu-solo-i-piatti.test.js`, 5 prove verdi) — ed è
lì che si vede la cosa che poteva sfuggire: la funzione del trigger ha il
permesso di esecuzione **revocato a tutti**, e un trigger funziona lo stesso.
Se non fosse così, in sala il rifiuto sarebbe diventato un errore diverso.

⚠️ **Non l'ho rifatta in produzione col token di un utente**, e non per
prudenza: scrivere righe di prova nei dati veri fuori da una migrazione è
proprio la cosa che le regole di questo progetto vietano.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha aperto l'Editor Menu.** Che l'elenco a video si sia
   accorciato non l'ha visto nessuno.
2. ⚠️ **In produzione ci sono 0 menu e 0 ricette**: la regola non ha incontrato
   nessun dato vero, e non può.
3. ⚠️ **Nessun menu esistente riesaminato**, perché non ce ne sono: il trigger
   guarda le righe **nuove o modificate**, non quelle già scritte.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento in questo passaggio.** Quello del giro — il n. 19, il
caso dei due prezzi che non si presenterà — è dichiarato nel
[riepilogo del lavoro](20260820_in_menu_solo_i_piatti.md).

---

## Per Alessio, in una riga

È in produzione e non si è mosso nessun numero del locale: il gestionale
rifiuta una preparazione o un bocconcino in un menu **anche se li segni pronti
per la carta**, e un piatto pronto entra come prima.

---

**Commit**: `53384d8` — «Applicata in produzione: in un menu ci vanno solo
i piatti».
**Working tree**: pulito.
**Migrazione**: 152 in produzione, **1 applicata in questo giro**.
**Prove**: 152 pure + 229 sull'app, tutte verdi.
