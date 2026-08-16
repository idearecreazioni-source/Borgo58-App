# Consegna del 16/08/2026 (sedicesima) — «in carta» applicata in produzione

**Commit della consegna: `a37c07a`** (il riepilogo precedente). Questo
riepilogo è la coda di [`20260816_le_piccolezze.md`](20260816_le_piccolezze.md)
e non porta codice nuovo: contiene i **numeri veri dell'applicazione in
produzione di `20260816000016`**, che al momento della sua scrittura non
era ancora applicata.

Working tree pulito. Questa consegna **non modifica** `docs/CONTRATTO.md`.

Oltre a questo file, l'unica altra modifica è l'aggiornamento di
`CLAUDE.md` (§6 il pattern del riflesso, §7 la voce chiusa, §10 le
piccolezze chiuse, §12 i conteggi).

---

## 1. `20260816000016_in_carta_e_un_riflesso` — applicata

```
Caselle «in carta» allineate al menu: 0 (nessuna).
«In carta» e' un riflesso del menu attivo, e i rifiuti stanno dove nasce il problema.
applicate e registrate: 1 su 1
totale migrazioni in produzione: 123
 ricette | in_carta | menu_attivi | caselle_che_mentono
       0 |        0 |           0 |                   0
```

**La sanatoria ha toccato 0 righe** — dichiarato, non sottinteso (regola
del 16/08): zero non è un errore, vuol dire «niente da allineare», ma va
detto.

---

## 2. Controlli dal connettore in sola lettura, dopo l'applicazione

| Controllo | Valore |
|---|---|
| Migrazioni in produzione | **123** |
| Ricette · menu · caselle in carta | 0 · 0 · 0 |
| **Caselle che mentono** (`in_carta` ≠ presenza in un menu attivo) | **0** |
| Righe in `recipe_status_history` | **0** |
| Ricette / menu `__VERIFICA__` rimasti | **0 / 0** |
| Trigger nuovi accesi (`O`) | **5 su 5** |
| Funzioni nuove eseguibili da `anon` o `authenticated` | **0 su 7** |
| Funzioni raggiungibili con la sola chiave pubblica | **11**, invariato |
| Policy intestate al ruolo `public` | **0** |

⚠️ **`recipe_status_history` a zero è il controllo che vale più degli
altri.** La verifica accende e spegne menu e sposta piatti dentro e
fuori dalla carta: ogni passaggio, su una ricetta vera, avrebbe scritto
una riga in quel registro. Zero righe significa che il collaudo non ha
lasciato tracce in un registro che nessuno potrebbe distinguere da quelle
vere. È la lezione del 14/08 (la verifica si ripulisce **rimettendo**, e
il controllo finale guarda anche ciò che è *cambiato*, non solo ciò che è
*rimasto*).

⚠️ **Nota emersa controllando**: il connettore in sola lettura **non può
eseguire `e_in_carta`** (`42501: permission denied`). È il
comportamento voluto — la funzione è revocata a tutti — e il valore di
«caselle che mentono» è stato quindi ricalcolato in query, con l'`exists`
scritto per esteso. Vale la pena saperlo per le verifiche future: la
colonna del `select` finale della migrazione gira come proprietaria, la
stessa riga dal connettore no.

---

## 3. Verifica del validatore, riportata qui perché conta

Il controllo che Alessio ha fatto dopo `20260816000015` **non è quello
ovvio**. Il numero delle policy (0 su 170) dice solo che la conversione è
avvenuta; la domanda vera era **se avesse toccato il percorso del form
pubblico delle prenotazioni**. Verificato: **le due funzioni del form
restano raggiungibili senza autenticazione**, come devono.

Se quella conversione avesse chiuso quel percorso, non ci sarebbe stato
nessun errore da nessuna parte: se ne sarebbe accorto il **primo cliente
che non riesce a prenotare**.

---

## 4. Cosa NON è verificato

- **Nessuna mano vera ha aperto le schermate toccate** in questa consegna
  e nella precedente. Il riflesso è provato dentro la migrazione (12
  controlli) e da `tests/app/in-carta-riflesso.test.js` (7 controlli col
  token di un utente vero), mai da un click.
- **Non c'è nessun piatto, nessuna ricetta e nessun menu in produzione**:
  il riflesso è acceso e non ha ancora niente da riflettere. Il primo
  esercizio vero sarà il primo menu che Alessio costruisce.
- **Il rifiuto «non posso rendere attivo questo menu» non è mai stato
  letto da lui**: il messaggio nomina tutti i piatti non pronti, ma la sua
  leggibilità con dieci piatti dentro non è stata provata.
- **La proprietà «zero policy al ruolo pubblico» non ha una prova
  automatica permanente** (vedi §10 del riepilogo precedente).

---

## 5. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **123** |
| Migrazioni nel repository / sul progetto di prova | 123 / 123 |
| Prove automatiche | 28 pure + 127 sul progetto di prova |
| Mandato di correzione | **completo, piccolezze comprese** |
| Piccolezze scartate | **1**, con la ragione (§7 del riepilogo precedente) |
