# Il gestionale vero riparte pulito

**24/08/2026** — sesta consegna della sessione, dopo `b8abcc8`. Via libera
di Alessio alla pulizia, dopo aver verificato lui stesso lo stato della
produzione e aver pushato.

| | |
|---|---|
| HEAD dichiarato | (l'ultimo commit di questa consegna) |
| produzione **prima** | 192 migrazioni · 28 conti · 43 tracce |
| produzione **adesso** | **196 migrazioni** · 0 conti · 0 tracce |
| prova | 197 migrazioni |
| applicate | **3** (`…022`, `…023`, `…024`) — più la `…012`, registrata dalla `…023` |
| in attesa | **1**: `20260824000001`, che aspetta il push |
| forma dei due database | **identica** — 105 tabelle, 281 funzioni, 201 policy |

---

## Cosa è stato tolto, misurato prima e dopo

| | prima | dopo |
|---|---|---|
| conti · righe · agganci · pagamenti | 28 · 53 · 32 · 2 | **0 · 0 · 0 · 0** |
| prenotazioni · agganci ai tavoli | 3 · 3 | **0 · 0** |
| giornate al completo · chiamate di turno | 1 · 1 | **0 · 0** |
| allarmi | 4 | **1** (quello del 12/08, aspetta la migrazione nuova) |
| tracce nel registro | 43 | **0** |

**Le tracce tolte sono state 98**: 43 dalla `…022`, e altre **55** dalla
`…024` — quelle che la cancellazione dei conti ha *prodotto*. È il numero
che la prova generale aveva anticipato, e la ragione per cui il registro
si svuota per ultimo.

## Cosa è rimasto in piedi

| | |
|---|---|
| disposizioni della sala | **14** ✅ |
| ricette · voci di carta | **14 · 14** ✅ |
| impegni in Agenda | **8** ✅ |
| sagome · causali · accessi | **13 · 17 · 4** ✅ |

⚠️ Le disposizioni restano per decisione esplicita di Alessio: *«sono la
pianta del mio locale, lavoro mio, e mi possono servire come base»*. Le
domande all'archivio invece vanno via — ma con la migrazione che aspetta
il push, quindi al momento sono ancora **6**.

## Le funzioni rispondono

Chiamate, non solo guardate: pianta della sala (13), coperti del giorno
(6), lista della spesa, partite in scadenza, prodotto fermo, quadratura
fiscale, saldo tesoreria, conti da fiscalizzare, e le due reti dei
permessi (**19 / 10**, gli stessi numeri della prova).

---

## 🔴 Si è fermata una volta, ed era prevedibile

Il primo tentativo si è fermato subito su `20260823000012`, che era ancora
in coda: `migra` applica in ordine, e lei viene **prima** della `…023` che
la registra. Si è fermata sulla sua verifica — la stessa di ieri — senza
toccare niente (192 migrazioni prima, 192 dopo: **controllato, non
dedotto**).

Rilanciato tenendola indietro, la `…023` ha fatto il suo lavoro: ha
rifatto il controllo con roba propria e l'ha registrata. **Nessuno stato a
metà**, a differenza di ieri.

---

## `20260824000001` — l'allarme e le domande

**Pronta e provata, aspetta il push.**

🔴 **L'allarme del 12/08 si spegne**, e la decisione ha cambiato verso
grazie a una misura: ieri l'avevo lasciato perché *raccontava un guasto
vero*. Aveva ragione la metà che guardava **com'era nato**; mancava quella
che guarda **com'è adesso** — `lettura_posta` ha girato con successo il
23/08 alle 22:00, e tutti gli altri cinque lavori sono in orario. Parole
di Alessio, e diventano una regola: *«un allarme acceso dopo che la causa
è passata è peggio di nessun allarme, perché abitua a ignorarli»*.

⚠️ **Non si toglie per data, si toglie per proprietà**: la condizione è che
il lavoro di cui si lamenta **abbia girato dopo**. Se un giorno fosse
davvero fermo, questa migrazione non lo zittirebbe — e la verifica prova
proprio quel verso, creando un allarme appena nato e pretendendo che
**non** rientri nel perimetro.

🔴 **E il primo controllo su ciò che non deve muoversi era sbagliato**: si
è fermato su un database sanissimo. Pretendeva che le disposizioni fossero
**almeno una**, e sul progetto di prova sono **zero** — quelle sono dati
della produzione. La proprietà giusta non è «ce ne sono», è **«quante ce
n'erano, tante ce ne sono»**: vale su qualunque database, anche vuoto. È
la lezione del 16/08, ripresa da capo.

---

## La prova generale, prima di toccare il vero

Tutte e quattro le migrazioni sono state applicate a una **copia fedele
della produzione**, ripristinata in un database usa-e-getta: 192 → 197
migrazioni, tutto il collaudo a zero, e intatti disposizioni, ricette,
voci di carta, impegni, sagome, causali e accessi. Zero errori nei cinque
file del ripristino.

⚠️ È il motivo per cui stanotte non c'è stata nessuna sorpresa: quello che
la produzione ha fatto era già stato visto succedere.

---

## Cosa abbiamo rovesciato

**Una cosa, e con una misura dietro.**

- **Cosa era stato deciso e quando**: il 23/08, poche ore fa, avevo deciso
  di **tenere** l'allarme del 12/08 in produzione.
- **La ragione di allora**: il §8 dice che gli avvisi veri non sono dati
  di prova ma la storia di ciò che ha funzionato, e quello raccontava un
  guasto realmente avvenuto.
- **Cosa si decide adesso** (Alessio, 24/08): si toglie.
- **Perché la ragione di allora non vale più**: perché guardava solo
  **com'è nato** l'allarme, e non **cosa dice adesso**. Il lavoro di cui
  si lamenta ha ripreso a girare da undici giorni: quell'avviso descrive
  un problema che non esiste. ⚠️ La regola del §8 non è caduta — si è
  precisata: *un avviso vero resta finché è vero.*

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato

- **Nessuna mano vera** ha aperto l'app dopo la pulizia.
- **`20260824000001` non è mai girata in produzione**: l'allarme del 12/08
  e le 6 domande all'archivio sono ancora lì.
- **Il ramo che pulisce non tornerà a girare**: dalla prossima volta la
  condizione sarà falsa (ci saranno movimenti veri). Quello che è stato
  provato è che **si ferma da sé** quando non deve pulire.
- **Il terzo progetto Supabase** resta fermo, in attesa che Alessio guardi
  dal pannello se costa.

---

## Cosa aspetta il tuo via libera

1. **Il push** di questi commit — poi applico `20260824000001` e spariscono
   anche l'allarme vecchio e le 6 domande.
2. **Il terzo progetto Supabase**, per provare il rientro degli accessi sul
   servizio di autenticazione vero.
