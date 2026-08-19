# Il portiere che mancava, e la rete che lo sorveglia

**Migrazione**: `20260819000007_il_portiere_delle_uscite_future.sql`
— applicata sul progetto di prova, **NON in produzione** (vedi in fondo).
**Autorizzata da Alessio** il 19/08/2026, con una condizione posta da lui:
*che non comporti un codice in più da digitare*. Non lo comporta — è lo
stesso controllo delle altre funzioni della Cassa, sull'account con cui si è
già entrati.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non è stata applicata in produzione**, e non per una scelta: lo
   script si rifiuta di toccare i dati veri finché le migrazioni non sono su
   GitHub, e il `git push` lo fa Alessio. Tutto quello che segue è misurato
   sul progetto di prova e sulla produzione **in sola lettura**.
2. 🔴 **Nessuna mano ha provato la schermata della Cassa dopo la chiusura.**
   La schermata è già riservata al titolare (`RequireTitolare`), quindi per
   lui non cambia niente — ma è una deduzione, non una prova.
3. ⚠️ **La rete guarda se il rifiuto è scritto, non se viene eseguito**: una
   funzione col rifiuto dentro un ramo mai percorso passerebbe. È la voce di
   coda «il controllo che guarda la forma invece del comportamento».
4. ⚠️ **`incasso_conto` resta senza portiere proprio**: il suo lo eredita da
   `totale_conto()`, che pretende un utente autenticato. Se un domani
   qualcuno togliesse quel controllo, questa non se ne accorgerebbe.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.** La regola del 13/08 — *ogni `security definer` ha
il suo portiere* — non è cambiata: è stata **applicata a un punto che le era
sfuggito**. E l'elenco dichiarato allora («quattordici restano aperte, ed è
una decisione») non viene contraddetto: viene **corretto nel numero**, che
nel frattempo era diventato falso senza che nessuno lo dicesse.

---

## 🔴 Il difetto

`uscite_future` è `security definer` — gira **senza la RLS** — e non
controllava chi la chiamasse. Legge `cash_movements` e restituisce **quanto
deve uscire, quanto è già uscito oggi, e quando cade la prima scadenza**. Con
l'accesso della sala (uno solo, condiviso) bastava chiederglielo.

⚠️ **Che sia una dimenticanza e non una scelta si vede dalle vicine**:
`saldo_tesoreria`, `previsione_cassa`, `movimenti_attesi`,
`quadratura_pagamenti`, `scarichi_senza_ricavo` hanno tutte il portiere, con
la stessa forma e quasi le stesse parole. È nata il 17/08 con
`20260817000001`, ed è la stessa famiglia dei due difetti chiusi il 13/08.

**La cura**: `if not is_titolare() then raise exception`. Un **rifiuto**, non
un elenco vuoto — una schermata vuota è una rassicurazione falsa (13/08).

---

## E gli altri? Misurati, non stimati

La domanda posta insieme all'autorizzazione era *«quante altre ce ne sono»*.
Misurato in produzione in sola lettura, e **la misura è cambiata mentre la si
faceva**, il che è la parte interessante.

**Prima misura** — cercando la *parola* `is_titolare()` o `auth.uid()` nel
corpo: **15** funzioni. Di queste, **una sola** restituisce denaro riservato a
chi non deve vederlo: `uscite_future`. Le altre quattordici o non toccano
importi, o toccano importi che chi è in sala ha comunque davanti.

🔴 **Seconda misura, e ha trovato di più.** Cercare la parola è la stessa
debolezza dei commenti, da un'altra porta: una funzione che nominasse
`is_titolare()` **dentro una stringa** sparirebbe dall'elenco senza
controllare niente. Cercando invece il **gesto** — *«se non sei il titolare,
rifiuta»*, che è la forma già scelta il 16/08 per `funzioni_col_portiere()` —
ne sono comparse **due che c'erano già e non si vedevano**:

| funzione | perché è legittima |
|---|---|
| `close_order_as_discount_gift` | chiudere un conto come sconto o omaggio è un gesto di sala, e gli importi sono quelli del conto che il cameriere ha davanti |
| `log_deleted_record` | è il trigger del registro delle cancellazioni: usa `auth.uid()` per annotare **chi**, non per chiedere chi |

🔴 **E il gesto si scrive in due modi.** `promuovi_disposizione` rifiuta con
`not (select is_titolare())`, con le parentesi — e **nessuna delle due reti
la vedeva**: la prima l'avrebbe accusata di non avere il portiere, la seconda
(`funzioni_col_portiere`, quella che protegge le migrazioni dalle sanatorie
che chiamano funzioni con la guardia) **non la proteggeva affatto**. Corretto
anche quello, nella stessa migrazione. ⚠️ *Un guardiano che riconosce una
sola delle due scritture della stessa cosa passa in silenzio.*

---

## Tre diagnostiche erano aperte a chiunque avesse fatto il login

Accendendo la rete è venuto fuori che le funzioni che **raccontano com'è
fatto il database** — `funzioni_multi_tabella`, `funzioni_col_portiere` e le
due reti nuove — non chiedevano niente a nessuno. Non è roba da sala, ed è la
stessa forma che `funzioni_aperte_ad_anon` ha dal 13/08: hanno preso il
portiere qui.

⚠️ E per `funzioni_senza_portiere` non è una formalità: senza, sarebbe
comparsa nel **proprio** elenco, oppure — peggio — se ne sarebbe esclusa da
sola perché il suo corpo contiene la parola `is_titolare()` dentro una
stringa. Col portiere vero le due cose coincidono.

---

## Il numero adesso è una prova, non una riga in un documento

L'elenco era **dichiarato in CLAUDE.md come «13»** ed era **15**: cresciuto
in silenzio. *Un conteggio scritto a mano in un documento è un'affermazione
che nessuna verifica controlla* (regola del 18/08).

Adesso `funzioni_senza_portiere()` se lo costruisce dal catalogo a ogni
esecuzione, e l'elenco congelato — **16 nomi, uno per uno** — sta in
`tests/app/permessi.test.js`, che gira tutti i giorni. Stessa forma di
`funzioni_aperte_ad_anon()`.

⚠️ **Sei delle quindici non erano mai state dichiarate per nome**: le tre
della lista della spesa (nel 2026-08-13 erano nominate solo come gruppo, e un
elenco per categorie non si può confrontare), `funzioni_multi_tabella`,
`incasso_conto` e `uscite_future`. E **una era nata oggi senza che nessuno lo
dicesse**: `righe_lista_aperte`, comparsa col blocco degli arrivi della lista
della spesa. Non espone prezzi — ma è esattamente il modo in cui l'elenco era
passato da 13 a 15.

---

## La controprova — rotto apposta

| rottura | cosa è diventato rosso |
|---|---|
| tolto `if not is_titolare()` da `uscite_future` | la migrazione si ferma: *«uscite_future ha risposto a chi non è il titolare»* |
| (dentro la verifica) una funzione che nomina la guardia **solo in un commento** | la rete la vede: se guardasse il testo grezzo, non comparirebbe |
| `promuovi_disposizione` | la verifica pretende che **compaia** fra quelle col portiere e **non compaia** fra quelle senza |

⚠️ Il rifiuto è provato **due volte, in due condizioni diverse**: come
proprietaria (dove `is_titolare()` è falso, regola nota dal 04/08) e con i
claims di uno **staff vero**. Il secondo è il caso reale — non «non c'è
nessun utente», ma «c'è un utente che non è lui».

---

## Per Alessio, in una riga

Chi entra col codice della sala non può più chiedere al gestionale quanto
devi pagare e quando. Per te non cambia niente: entri come sempre.

---

**Commit del lavoro**: `7e75a48` — «Il portiere che mancava sulle uscite future».
**Working tree**: pulito al momento del commit del lavoro.
**Migrazioni**: `20260819000007` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
