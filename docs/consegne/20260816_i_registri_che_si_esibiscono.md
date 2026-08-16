# Consegna del 16/08/2026 (decima) — Blocco 6 del mandato di correzione

**Commit della consegna: `351ffe3`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `351ffe3` | i registri che si esibiscono — migrazione `20260816000010` |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000010` è già applicata in produzione** (§5).
Nessuna operazione nuova nel corridoio.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

Del mandato restano il **7** (allergeni sul menu stampato), l'**8** (i
fili scollegati), il **9** (il pagamento misto) e le piccolezze.

---

## 1. Il destinatario di questo blocco non è Alessio

I quattro rilievi hanno in comune chi legge il risultato: **un ispettore,
la commercialista, un domani il fisco.** Un registro che si esibisce non
può contenere una riga che dichiara qualcosa che non è avvenuto — ed è
una categoria di difetto diversa da un numero sbagliato, perché il danno
non è un conto che non torna: è una dichiarazione falsa fatta in buona
fede.

---

## 2. 6.1 — La non conformità che si chiudeva senza dire cosa hai fatto

Il registro temperature e il ricevimento merci promettono, **testuale**:
*«resta APERTA finché non scrivi cosa hai fatto»*. E si premeva «Conferma
risoluzione» col campo vuoto: `resolved_has_timestamp` chiedeva **solo la
data**.

Nel manuale esibibile quella riga compariva come «risolta» senza azione
correttiva. ⚠️ **Davanti a un ispettore è peggio di una non conformità
ancora aperta**: una aperta dice «me ne sto occupando», una chiusa senza
rimedio dichiara un rimedio che non c'è.

**Cura in due posti**, e quello che conta è il secondo:

| Dove | Cosa |
|---|---|
| Schermata | campo obbligatorio, pulsante disabilitato finché è vuoto, e la frase «finisce nel manuale che si mostra a un controllo» |
| **Database** | vincolo `nc_risolta_ha_rimedio`: `resolved` richiede `corrective_action` non vuota — **e uno spazio bianco non passa** (`btrim`) |

> *La promessa non può vivere solo nei messaggi.*

⚠️ **E NON si allarga al momento della registrazione**, che è la parte da
non sbagliare. Dal 13/08 una lettura fuori range apre da sé una non
conformità e **non blocca il salvataggio**, apposta: *davanti a un campo
obbligatorio, di sera, uno non scrive il rimedio — non registra la
misurazione, e una misurazione persa è irrecuperabile.* Qui si vincola
**solo la chiusura**, che è un gesto che si fa con calma. C'è una prova
automatica dedicata a questo confine, perché non si sposti in futuro
senza che nessuno se ne accorga.

---

## 3. 6.4 — Una fattura senza numero non è una fattura

`orders_documento_coerente` chiedeva la data e non il numero: si premeva
«Fattura fatta» col campo vuoto, e il conto **spariva dall'elenco di
quelli da sistemare portandosi via la differenza fra incassato e
fiscalizzato** — cioè proprio il numero che quella schermata esiste per
far tornare.

Ora il vincolo chiede data **e** numero, e il pulsante è disabilitato
finché il campo è vuoto. ⚠️ **Lo scontrino continua a non chiedere né
data né numero**: il vincolo non si è allargato a ciò che non riguarda, ed
è verificato sia nella migrazione sia nella suite.

---

## 4. 6.2 e 6.3 — Le tracce

`foraged_items` (raccolta propria) era **l'unico registro HACCP
cancellabile dall'interfaccia**, a un tocco e senza traccia. Ora:
conferma che nomina la specie e la data, **e** copia nel registro delle
cancellazioni.

⚠️ **La traccia è la parte che non si può aggirare**: la conferma vive
nella schermata, ma una cancellazione fatta da un altro tablet o dritto
dal browser resta scritta lo stesso. (Pulizia e disinfestazione fanno già
la cosa giusta: non si lasciano cancellare affatto.)

Con lei entrano nel registro **`anticipazioni_socio`**, **`conteggi_cassa`**
e **`deductible_expenses`**. Le tabelle sorvegliate passano da **15 a 19**
— `order_items` era entrata col Blocco 4.

⚠️ **Il Ricettario resta fuori**, per la scelta dichiarata nella
migrazione dell'08/08 («una cancellazione di ricetta è una correzione»), e
il mandato dice esplicitamente di non toccarla.

---

## 5. Cosa è stato verificato, e i numeri veri

**Dentro la migrazione**, col ruolo vero del titolare:

| # | Controllo | Esito |
|---|---|---|
| 1 | Chiudere una non conformità col campo vuoto | **respinto** |
| 2 | Chiuderla con uno spazio bianco | **respinto** |
| 3 | Chiuderla col rimedio scritto | riuscito |
| 4 | **Aprirne una nuova senza rimedio** | **riuscito** — il confine del 13/08 è intatto |
| 5 | «Fattura» con data ma senza numero | **respinto** |
| 6 | «Fattura» con data e numero | riuscito |
| 7 | «Scontrino» senza data né numero | riuscito |
| 8 | Raccolta propria cancellata → traccia nel registro | sì |
| 9 | Nota «di tasca mia» cancellata → traccia nel registro | sì |
| 10 | Tabelle sorvegliate ≥ 19 | sì |

**Prove automatiche:** 3 nuove in `tests/app/registri-esibibili.test.js`.
Suite intera: **20 pure + 114 sul progetto di prova, tutte verdi.** Lint a
zero, build ok. **Idempotenza:** applicata due volte di fila sul progetto
di prova.

**In produzione** (`npm run migra -- --conferma`, dopo il push):

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 117
tabelle_tracciate: 19 | risolte_senza_rimedio: 0 | fatture_senza_numero: 0
```

⚠️ **Lo stato di partenza è stato letto col connettore PRIMA di scrivere
la migrazione**: zero non conformità (aperte e risolte), zero raccolte
proprie, zero conti con «fattura» e numero vuoto. **Nessun vincolo ha
avuto bisogno di una sanatoria e nessuna riga esistente è diventata
illegale.** Se ce ne fosse stata una, un `check` aggiunto così l'avrebbe
resa **immodificabile per sempre** — e il rimedio giusto sarebbe stato un
altro (sanatoria prima, vincolo dopo).

---

## 6. Un fatto trovato scrivendo la prova, non leggendo

**Chiudere una non conformità è già riservato al titolare**
(`haccp_nc_upd_titolare`), mentre **aprirla la può fare tutto lo staff**.
Le due cose stanno bene così: chi è in cucina deve poter registrare un
problema, chi risponde a un'ispezione deve poterlo chiudere.

⚠️ Ma la prima versione della prova usava lo staff per la chiusura, e
**passava senza che il vincolo funzionasse**: l'`update` non toccava
nessuna riga, quindi PostgREST non restituiva nessun errore. *Un rifiuto
silenzioso, dentro una prova, si legge esattamente come un vincolo che non
funziona.* È lo stesso modo di fallire del `.limit()` sui documenti
esibibili — qualcosa che sembra completo e non lo è.

---

## 7. Cosa NON è verificato

- **Nessuna mano vera.** Non esistono non conformità, raccolte proprie o
  conti fatturati in produzione: i due vincoli nuovi non hanno mai
  respinto nessuno davanti a una persona.
- **Il manuale HACCP esibibile non è stato rigenerato** dopo la modifica:
  non contiene righe, quindi non c'era niente da guardare. Il vincolo
  garantisce che d'ora in poi non possa contenerne di sbagliate, non
  ripara quelle vecchie — che non ci sono.
- **La conferma sulla raccolta propria non è stata premuta da nessuno**;
  è provata solo la traccia, che è la metà che conta.
- **Il vincolo sulla fattura non copre `fattura_da_emettere`**, ed è
  voluto: quella dice «l'ho promessa al cliente», non «l'ho fatta», e un
  numero non esiste ancora.
