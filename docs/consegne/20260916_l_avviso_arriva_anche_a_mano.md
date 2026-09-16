# 16/09/2026 — L'avviso Telegram arriva anche a «Fallo a mano»

## Perché

Un appunto dettato a MEMO capisce **quattro date distinte**: quando *succede*
l'impegno (`data`, `ora`) e quando *avvisare* (`avviso_data`, `avviso_ora`),
che è quasi sempre un altro giorno. Approvando l'appunto arrivavano tutte e
quattro. Scegliendo **«Fallo a mano»**, invece, il modulo dell'Agenda si
apriva con titolo, giorno e ora dell'impegno e i campi del **Promemoria
Telegram vuoti** — e «Fallo a mano» chiude comunque l'appunto.

⚠️ La notifica spariva **senza nessun errore**: nessuna riga rossa, nessun
avviso, e chi salvava credeva di averla. È la famiglia dei difetti silenziosi
di questo progetto — il valore che non arriva e nessuno lo dice.

Il secondo difetto stava sullo stesso giro: **«mandami una notifica fra cinque
minuti» non poteva funzionare**. Al modello si diceva soltanto il giorno, mai
l'ora, quindi le espressioni relative non avevano un punto di partenza.

## Cosa cambia

- **Migrazione `20260916000002_l_avviso_arriva_anche_a_mano.sql`** — aggiunge
  due chiavi al solo ramo «promemoria» di `azione_campi`: `avviso_data` e
  `avviso_ora`. Nient'altro.
  ⚠️ Quali campi arrivano al modulo **non lo decide la schermata**, lo decide
  questa funzione del database: è scritto nel telaio stesso della via
  d'uscita a mano (*«quello che questo file non decide: dove si va e quali
  campi. Vive nel database»*). Senza la migrazione, il client non ha modo di
  conoscere l'avviso.
  ⚠️ Gli altri undici rami sono ricopiati identici: `create or replace` vuole
  il corpo intero, e riscriverne uno monco toglierebbe la via d'uscita a mano
  agli altri tipi. Il blocco di verifica li ricontrolla uno per uno.
  ⚠️ **Non tocca nessuna tabella e nessuna riga**: la funzione è di sola
  lettura (`stable`) e trasforma un jsonb in un altro jsonb. Nessuna colonna
  nuova, nessun permesso, nessuna policy.
- **Il modulo dell'Agenda** mappa le due chiavi nuove sui campi del
  Promemoria Telegram. Se l'avviso non era stato chiesto le chiavi non
  arrivano proprio, e i campi restano vuoti: **nessun avviso senza richiesta
  esplicita**, senza una riga in più.
- **Il riferimento orario Europe/Rome** (`ascolta-voce/adesso.ts`): al modello
  si dice adesso anche **l'ora**, così «fra cinque minuti» diventa una data e
  un'ora assolute.
  ⚠️ Il fuso è quello del locale, **non del server**: le funzioni online
  girano a Greenwich e d'estate l'Italia è due ore avanti — un avviso
  calcolato sull'ora del server nascerebbe già passato, e il database lo
  rifiuterebbe.
  ⚠️ Sta in un file a sé per poterlo **provare**: dentro `index.ts`
  nascerebbe da `new Date()` e nessuna prova potrebbe fissarlo.
- **Il tipo «promemoria» era dichiarato due volte** nel testo che guida il
  modello, e una delle due non nominava i campi dell'avviso: finché restava
  così, il modello poteva leggere l'elenco corto e lasciar cadere l'avviso
  che aveva capito.

## Prova eseguita su Borgo58-Prova

- Corpo vivo di `azione_campi` confrontato con quello della migrazione:
  **coincide** — nel vivo non c'è nulla che la migrazione non abbia, e ciò che
  la migrazione aggiunge sono **soltanto** le due righe dell'avviso.
- Migrazione applicata al solo progetto di prova, verifica interna passata e
  `20260916000002` registrata come ultima.
- `azione_campi` interrogata sui tre casi: con avviso porta `avviso_data` e
  `avviso_ora` **senza confonderli** con giorno e ora dell'impegno; senza
  avviso quei campi **non compaiono affatto**; con mezzo avviso arriva solo il
  pezzo detto, e nessuna ora viene inventata.
- `ascolta-voce` installata **solo sul progetto di prova**.
- Dettatura reale con «fra cinque minuti»: l'appunto è nato con **data e ora
  assolute e future**, esatte al minuto.
- 🔴 **Nessun Telegram è partito, ed è misurato**: l'appunto è rimasto *in
  attesa*, con **zero impegni scritti** e **zero promemoria armati**. Non è
  stato approvato.
- «Fallo a mano» sull'appunto vero: porta a `/agenda/nuovo` **con i due campi
  Telegram già riempiti**.
- L'appunto di prova è stato scartato con il **normale percorso del
  gestionale**, non cancellando righe a mano: nessun dato di prova rimasto.
- Prove automatiche contro il progetto di prova: **tutte verdi**. Lint pulito,
  compilazione riuscita.
- Sei prove nuove sul riferimento orario (ora legale, ora solare, mezzanotte
  che cambia giorno, mezzanotte esatta, giorno del cambio d'ora) e tre su
  «Fallo a mano».
  ⚠️ **E discriminano**: rotte apposta diventano rosse, e resta verde quella
  del «senza avviso» — che è il risultato giusto, perché quella prova non
  dipende dalla correzione.

## Cosa non cambia

- **La produzione non ha ancora ricevuto né la migrazione né la funzione
  online.** Il codice è in master; il database vero e `ascolta-voce` in
  produzione sono invariati.
- Finché la migrazione non è applicata, in produzione «Fallo a mano»
  continua a non portare l'avviso; finché la funzione online non è
  pubblicata, «fra cinque minuti» resta senza riferimento orario.
- Nessun dato è stato toccato, né in produzione né altrove: la migrazione non
  scrive righe e la verifica lavora su valori inventati.

## Cosa abbiamo rovesciato

Niente. Le regole in vigore restano intere e questa consegna le rafforza:
nessun Telegram parte dalla sola dettatura, l'appunto resta da approvare,
«Approva» crea un solo impegno con un solo promemoria, e un avviso non
chiesto non compare.

## Passo successivo

Controllo del diff e della proposta. Soltanto dopo un ok separato si potrà
applicare `20260916000002` in produzione e, come passo distinto, pubblicare
lì la funzione online.
