# La validità di trenta giorni, e il mandato del magazzino

**Applicato in produzione**: `20260820000007_il_foglio_del_preventivo` — 1 su 1,
**157 migrazioni**. Funzione online `email-cliente` **v3 → v4**.
**Migrazione nuova**: `20260820000008_la_validita_di_trenta_giorni` — sul
progetto di prova, **non ancora in produzione**.

---

## I numeri veri dopo l'applicazione

**157 migrazioni**, e tutto invariato: 0 ricette, 26 tracce, 0 movimenti, 8
conti di cui 0 aperti, 0 preventivi, 0 fogli. Reti di sorveglianza ferme:
**16 · 10 · 0 · 0 · 0 · 0**.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mail è mai partita davvero.** La funzione online è adesso in
   produzione, ma il giro completo — Alessio preme, il cliente riceve — non
   l'ha fatto nessuno.
2. 🔴 **Nessuna mano ha premuto niente**, per decisione di Alessio: tutte le
   prove con le mani al collaudo generale.
3. ⚠️ **La migrazione della validità non è in produzione**: aspetta il push.

---

## Cosa abbiamo rovesciato

**Un rovesciamento, il n. 20** ([`decisioni_rovesciate.md`](../decisioni_rovesciate.md)),
scritto su indicazione della validazione: *«il preventivo si manda col PDF
allegato»*.

⚠️ **Non era una decisione sbagliata: dava per scontata una cosa che in questo
gestionale non esiste.** Il PDF è la stampa del browser, e il gestionale non ha
mai un file fra le mani. 🔴 **Eseguendo alla lettera** si sarebbero prodotti
messaggi che annunciano un allegato che non c'è: **nessun errore da nessuna
parte**, e a scoprirlo sarebbe stato **il cliente**, non Alessio.

⚠️ E la strada alternativa — aggiungere una libreria PDF — è **dichiarata e non
presa**: sarebbe una decisione architetturale, e il giorno che servisse un
allegato vero si riapre.

---

## 🔴 Trenta giorni, e la scadenza mancava proprio sul foglio

Deciso da Alessio, come valore **proposto e modificabile** su ogni preventivo.
Un preventivo nuovo nasce con la sua scadenza già calcolata.

🔴 **E costruendolo è saltata fuori una cosa che non era vera**: la scadenza
c'era nella mail e nel messaggio WhatsApp, ma **non nella vista che si
stampa** — cioè proprio sul foglio di carta che il cliente si porta via, che è
il posto per cui la regola esiste. *Il pezzo che viaggia di più era l'unico
senza.* Corretto.

⚠️ **Tre cure, non una sola**, e ognuna copre un modo di sbagliare diverso:

| | |
|---|---|
| la scadenza si **propone** | un preventivo non nasce più senza |
| ma **si scrive solo alla nascita** | correggere un preventivo **non riporta avanti** una scadenza che Alessio aveva accorciato a mano — c'è la prova, ed è la più insidiosa delle tre: nessuno se ne sarebbe accorto |
| e in correzione si tocca **solo se nominata** | una chiave assente vuol dire «non l'ho toccata», non «cancellala» |

⚠️ **E si conta da `oggi_a_roma()`**, mai da `current_date`: il database vive a
Greenwich, e fra mezzanotte e le due un preventivo nascerebbe con **un giorno
di validità in meno**.

---

## 🔴 Una prova è diventata rossa, e per la ragione giusta

Quella che verifica il rifiuto senza scadenza: da quando la scadenza si
propone da sé, **un preventivo senza non nasce più**.

⚠️ **Non l'ho disattivata: le ho fatto costruire il caso** — toglie la scadenza
e poi chiede il foglio. *Una prova che non costruisce più il caso che
sorveglia smetterebbe di guardarlo senza diventare rossa*, ed è il modo in cui
un controllo muore in silenzio.

E ne è nata una in più: un preventivo nuovo **nasce valido trenta giorni**.

---

## Le prove

**Tre controlli dentro la migrazione** e **13 prove col token di un utente
vero** sui preventivi — 152 pure + **258** sull'app in tutto.

---

## Il mandato del magazzino, scritto

[`20260820_l_allineamento_del_magazzino.md`](../mandati/20260820_l_allineamento_del_magazzino.md).
**Non è per adesso**: è scritto perché le decisioni sono fresche.

🔴 **Il problema l'ha posto Alessio**: le quantità che il gestionale scarica
sono **stimate**, quindi quel numero **non è una giacenza — è una previsione**.
⚠️ E va **chiamato così a schermo**: il giorno che lo si chiama «giacenza» si
smette di controllarlo.

✅ **La misura dice che metà esiste già**: le partite col loro costo, il
conteggio col sotto-scorta, gli scarichi con `rettifica` **già fra i motivi**,
e la meccanica FEFO. Manca **il gesto di dichiarare quanto c'è** (oggi si può
solo togliere una quantità) e i **due numeri del food cost**.

⚠️ **E una misura da fare prima di costruire, scritta nel mandato**: partite
diverse dello stesso prodotto hanno **prezzi diversi**, quindi *da quale si
toglie cambia il valore dello scostamento*. Va misurato e dichiarato, non
deciso in silenzio.

---

## Per Alessio, in una riga

Un preventivo adesso nasce valido trenta giorni, e la scadenza è scritta anche
sul foglio che stampi — prima c'era solo nella mail e su WhatsApp.

---

**Migrazione**: `20260820000008` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
