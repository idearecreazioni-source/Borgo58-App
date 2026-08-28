# Blocco 2 — un server aperto per misurare non si porta via il telefono

**28/08/2026** · Blocco 2 del mandato. Alessio non riusciva più ad aprire il
gestionale dal telefono da ieri sera.

| | |
|---|---|
| **HEAD dichiarato** | `5eed218` — *Un server aperto per misurare non si porta via il telefono di Alessio* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | nessuna — al database non serviva niente |
| **Comando nuovo** | `npm run telefono` |
| **Prove** | 525 di calcolo — verdi; lint a zero; build pulita |

---

## La diagnosi del mandato è caduta a metà, e va detto

Il mandato supponeva: *il tunnel inoltra alla 5199, l'app risponde sulla 5173,
quindi il proxy consegna il vuoto.* **La prima metà era giusta, la seconda no.**

Misurato oggi:

| | |
|---|---|
| porte in ascolto sul computer | **solo la 5173** |
| dove punta il tunnel **adesso** | **5173** — non 5199 |
| l'indirizzo cifrato risponde? | ✅ `/` e `/dashboard` → HTTP 200 |
| che gestionale c'è dietro | **il database di prova** |

Quindi **fra la scrittura del mandato e adesso qualcuno l'ha già ripuntato**.
Lo stato di oggi è sano.

🔴 **Il che non chiude niente**: il difetto non è lo stato di adesso, è che
**quello stato si rifà da solo alla prossima misura**.

---

## La causa vera. Non è Tailscale: è chi gli cambia il bersaglio

`tailscaled` gira come servizio di Windows e la sua configurazione sopravvive
al riavvio da sé. Quello che non sopravvive è il server del gestionale — e
`dev-prova.mjs` **ripuntava sempre il tunnel alla porta del proprio avvio**.

È giusto in sé: altrimenti l'indirizzo cifrato aprirebbe un gestionale diverso
da quello appena acceso. Ma la conseguenza è che

> **`npm run dev:collaudo`, che apre la 5199 solo per misurare le schermate, si
> porta via l'indirizzo con cui Alessio lavora — e quando quel server viene
> chiuso, nessuno lo rimette a posto.**

🔴 **E il danno non è il tunnel rotto: è che un tunnel che punta nel vuoto e
uno che lavora si vedono UGUALI.** `https`, il lucchetto, e una pagina bianca.
Nessun errore, da nessuna parte — cioè la stessa forma di *«un guardiano che
non risponde è indistinguibile da uno che lavora»*.

---

## La regola, adesso in un posto solo

In [`scripts/telefono.mjs`](../../scripts/telefono.mjs), usata sia da
`dev-prova.mjs` sia da `npm run telefono`: **una regola scritta in due corpi
fra sei mesi cambia in uno solo.**

| situazione | cosa fa |
|---|---|
| non c'è nessuna pubblicazione | la crea su questa porta |
| punta già a questa porta | non tocca niente |
| punta altrove, e di là **risponde** | 🔴 **non ruba** — e lo dice |
| punta altrove, e di là è **muto** | lo riprende — e dice da dove veniva la pagina bianca |

⚠️ **Il terzo caso è il cuore**: un server aperto per misurare non ha nessun
titolo a portarsi via l'indirizzo con cui si lavora. Il quarto è la
riparazione: il prossimo avvio vero rimette a posto ciò che un usa-e-getta ha
lasciato rotto — **senza che nessuno debba ricordarsene**.

---

## Provata rompendola, non rileggendola

| prova | esito |
|---|---|
| tunnel puntato alla 5199 morta — **lo stato esatto di Alessio** | 🔴 *«NON RISPONDE NESSUNO su quella porta. Dal telefono si vede una PAGINA BIANCA»* |
| un usa-e-getta chiede il tunnel mentre la 5173 lavora | `occupato-da-vivo` — **il tunnel non si sposta** |
| tunnel su porta morta + un avvio vero | `ripreso` — torna alla 5173 |
| stato sano | ✅ *«Risponde. Dietro c'è: il database di prova.»* |

Tunnel riportato alla 5173 e ricontrollato alla fine: `/` e `/dashboard`
rispondono 200, e nessuna intestazione vieta il microfono.

### Due difetti miei, trovati provando

1. **`npm run telefono` non stampava NIENTE**, e sembrava a posto. Il confronto
   fra il percorso del file e quello del comando non combacia mai su Windows:
   lo spazio di «Claude code» diventa `%20` da una parte e no dall'altra.
2. **Importare il modulo faceva morire chi lo importava**, perché
   `process.argv[1]` non c'è sempre. Trovato importandolo per provarlo.

⚠️ **E cercando quale gestionale c'è dietro una porta ci sono cascato**:
`src/lib/ambiente.js` nomina **tutt'e due** i progetti come costanti, quindi
cercare il nome nel sorgente risponde sempre di sì a tutt'e due. Si guarda
l'indirizzo **iniettato**, non quello scritto. *Un misuratore si prova su un
caso di cui si conosce già la risposta.*

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore è stata contraddetta: l'indirizzo
cifrato obbligatorio (27/08) resta intero, e la ragione per cui `dev-prova`
ripunta il tunnel resta valida — le si è solo tolto il diritto di rubarlo a un
server vivo.

---

## Cosa NON è verificato

- 🔴 **Il microfono non l'ha provato nessuno da un telefono vero.** Ho
  verificato la *condizione* — indirizzo cifrato, HTTP 200, nessuna
  intestazione che lo vieti — non il permesso concesso da Safari.
- 🔴 **Non ho visto lo schermo bianco con i miei occhi**: l'ho riprodotto
  puntando il tunnel a una porta morta e leggendo cosa risponde il guardiano.
- ⚠️ **Non so chi abbia ripuntato il tunnel alla 5173** fra il mandato e
  adesso. Non l'ho fatto io; l'ho constatato e basta.
- ⚠️ **Non ho fermato nessun server**: la 5173 è condivisa con Alessio.
