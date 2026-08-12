# Consegna del 12/08/2026 — il falso allarme della sentinella

**Commit della consegna: `e673ff6`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

Riguarda `20260812000008` (*ogni lavoro pianificato nasce col battito*),
**già applicata in produzione**. Non c'è niente da applicare: c'è una cosa
da sapere, e una regola nuova in `CLAUDE.md` §8.

---

## 1. Cosa è successo

| Ora | |
|---|---|
| 12:16:31 | Alessio applica `20260812000008` in produzione |
| 12:30:00 | Telegram: *«Il lavoro «lettura-posta» non arriva in fondo da 170 minuti. La posta in arrivo non viene più letta»* |
| 12:30:00 | (stesso secondo) il lavoro scrive il battito nuovo — e da lì è sano |

**La posta veniva letta regolarmente.** Verificato in produzione, dal
connettore in sola lettura: `lettura-posta` risulta eseguito da `pg_cron`
alle 09:45, 10:00, 10:15 … 12:30, **tutti `succeeded`**, senza un buco.

---

## 2. Perché

La migrazione cambia **cosa misura** il battito di `lettura_posta`:

- prima: *«l'ultima volta che ho chiamato l'AI»* — scritto solo quando
  c'era posta da leggere;
- dopo: *«l'ultima volta che ho fatto il giro»* — scritto sempre.

Il cambio è voluto ed è metà del senso di quella migrazione: sorvegliare
la misura vecchia avrebbe fatto gridare la sentinella ogni notte
tranquilla. **Sta scritto nel commento della migrazione stessa.**

Poi però la migrazione semina i battiti con:

```sql
insert into stato_lavori (nome, ultimo_successo)
select nome_lavoro, now() from lavori_sorvegliati
on conflict (nome) do nothing;
```

Su `lettura_posta` la riga **esisteva già**, ferma alle 09:39 — l'ultima
volta che c'era stata posta da leggere. `do nothing` non fa nulla, e
quella riga sopravvive: una misura della cosa vecchia, letta col metro
nuovo. 09:39 contro una tolleranza di 45 minuti = 170 minuti di silenzio
apparente.

**La regola generale, ora in `CLAUDE.md` §8**: se una migrazione cambia il
*significato* di un valore, il valore vecchio non deve sopravviverle.
`do nothing` va bene solo se il vecchio significa ancora la stessa cosa;
altrimenti serve `do update set … = now()`, con scritto il perché.

---

## 3. Perché il progetto di prova non l'ha intercettato — la parte che conta

Sul progetto di prova la riga `lettura_posta` **non esisteva**: quel
lavoro non aveva mai avuto posta da leggere, quindi non aveva mai scritto
un battito. Il `do nothing` non aveva niente da non-fare, la riga nasceva
con `now()`, e la verifica passava.

> La prova non era falsa. Era su uno **stato di partenza** diverso da
> quello vero, esattamente nel punto rilevante.

È il limite strutturale di un ambiente di prova ricostruibile da zero:
riproduce fedelmente lo *schema*, non la *storia*. Ogni migrazione che
tocca dati già esistenti va guardata anche col connettore in sola lettura
— *cosa c'è davvero in produzione adesso* — non solo con ciò che
produrrebbe una ricostruzione.

---

## 4. Cosa NON ho fatto, e perché

**Nessuna migrazione correttiva.** In produzione la riga è sana dalle
12:30:00 e si riscrive ogni quarto d'ora; su una ricostruzione da zero il
caso non si presenta, perché non c'è nessuna riga da preservare. Una
migrazione qui sarebbe un no-op cerimoniale in ogni database esistente.

Resta un caso di rientro possibile e dichiarato: ripristinare una copia
di sicurezza **precedente** alle 12:16 dentro un database con le funzioni
nuove riprodurrebbe il falso allarme, una volta, per un quarto d'ora.

Se non sei d'accordo — è la tua chiamata — la correzione è una riga.

---

## 5. Il lato buono, che non va perso nel resoconto

L'allarme è arrivato **su Telegram, entro 14 minuti, con scritto in
italiano cosa avrebbe smesso di funzionare**, da un lavoro che stamattina
non era sorvegliato da nessuno. La catena — battito, censimento, freno,
notifica, frase leggibile — ha funzionato in ogni suo anello, alla prima
occasione vera, contro il suo stesso autore.

Il freno ha retto: **un solo avviso**, non uno ogni quarto d'ora.

Un sistema di allarme che non ha mai suonato non è un sistema di allarme
verificato. Questo ha suonato, e si è potuto risalire alla causa in
cinque minuti perché il messaggio diceva *quale* lavoro, *da quanto* e
*con quale conseguenza*.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| la posta è stata letta senza interruzioni | **verificato in produzione**: 12 esecuzioni consecutive `succeeded` |
| i quattro battiti adesso | **verificati**: tutti dentro la loro tolleranza |
| un solo avviso, non uno per giro | **verificato**: una sola riga in `allarmi` |
| regola nuova in `CLAUDE.md` §8 | scritta |
| lint, prove di unità, build | puliti |
