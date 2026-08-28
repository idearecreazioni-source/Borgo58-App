# Blocco 2 — la Posta dice se MEMO sta leggendo

**28/08/2026** · Nasce da tre schermate di Alessio delle 22:03-22:07.

| | |
|---|---|
| **HEAD dichiarato** | `86cd4bc` — *La Posta dice se MEMO sta leggendo, e la funzione nuova non nasce piu' aperta* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000012`, `20260828000013` |
| **In produzione** | 🔴 **nessuna delle due** — aspettano il push |
| **Sul progetto di prova** | applicate: **317** migrazioni |
| **Prove** | 39 pure sulla Posta · l'intera suite verde dopo le correzioni |

---

## Quale delle due — misurato

Tre mail del 19, 20 e 21 agosto dicevano tutte e tre «Non ancora letta — la
lettura parte da sola entro un quarto d'ora». Erano lì da **nove giorni**, col
computer acceso quasi sempre.

| | |
|---|---|
| lavori pianificati sul progetto di **prova** | **zero** |
| lavori pianificati in **produzione** | **sei**, e battono da due minuti |
| ultimo battito della lettura sulla prova | **23/08 all'01:00** |

🔴 **Quindi non è «non è mai stato acceso»** — che era la mia prima
conclusione. **Ha girato fino al 23/08 e poi si è fermato.** La misura ha
corretto la diagnosi.

### Il telaio, non il caso

`npm run prova:ricostruisci` **toglie** tutti i lavori pianificati prima di
svuotare lo schema — ed è giusto: restare programmati su funzioni che stanno
per sparire produce errori a ripetizione. A rimetterli sono le **sei
migrazioni** che li creano; ma `prova:migra` applica solo le migrazioni
**mancanti**, e quelle risultano già applicate.

> Basta un giro che tolga i lavori senza riapplicare tutto, e il progetto di
> prova resta **senza niente che gira**.

⚠️ **E nessuno lo grida**, perché la sentinella che sorveglia i lavori **è
essa stessa uno dei lavori**: un testimone non testimonia della propria
assenza. È un limite già dichiarato dal 12/08, e oggi si è visto cosa costa —
nove giorni.

---

## La risposta c'era già, e nessuno poteva leggerla — terza volta oggi

`lavori_in_silenzio()` esiste dal 12/08, sapeva già che la lettura era muta da
**8374 minuti**, e aveva già la frase giusta: *«La posta in arrivo non viene
più letta: fatture e documenti restano fermi nella sala d'aspetto»*.
Era eseguibile **dal solo proprietario del database**.

È lo stesso schema di `riprova_lettura_posta` (esisteva dal 12/08 senza
pulsante) e della soglia di magazzino del 13/08: **tutto acceso, e muto**.

⚠️ **Non si duplica la regola**: `lettore_posta_fermo()` **domanda** a
`lavori_in_silenzio()`. Chi decide quando un lavoro è muto resta uno solo, con
la sua tolleranza scritta in `lavori_sorvegliati` (45 minuti) invece che in
una schermata.

### Il portiere è `auth.uid()`, non `is_titolare()`

`chiedi_lettura_posta` ha **due chiamanti con due identità**: il lavoro
pianificato, che gira come proprietario e per cui `is_titolare()` è **falso**,
e il titolare che preme «Leggila adesso». Un portiere scritto `if not
is_titolare()` avrebbe **spento la lettura automatica della posta in
silenzio** — è la trappola misurata il 27/08.

✅ Provato: col portiere sbagliato la verifica diventa rossa.

---

## Cosa si vede adesso, guardato con gli occhi

| prima | adesso |
|---|---|
| «Non ancora letta — la lettura parte da sola entro un quarto d'ora» | «**MEMO non sta leggendo la posta su questo gestionale (fermo da 5 giorni)**. Questa mail resterà così finché non gli chiedi tu di leggerla.» |
| nessun gesto | **«Leggila adesso»** |
| lo stato si deduceva dalla presenza di una proposta sotto | «**Letta da MEMO il …**», detto in chiaro |

⚠️ **I minuti si dicono in parole**: «8374» non significa niente per nessuno,
«da 5 giorni» sì — ed è la cosa che fa capire che non è un ritardo, è un
guasto.

---

## Il difetto mio, preso da una rete del 13/08

Nella `20260828000010` ho scritto `create or replace function
preavviso_giorni(p_esplicito integer)` con una **firma nuova** — cioè una
**funzione nuova**, nata coi permessi predefiniti di Postgres: **eseguibile
con la chiave anonima**, che in questo progetto è pubblica e sta nel pacchetto
del sito. Le funzioni aperte all'anonimo erano passate da **12 a 13**.

🔴 **E la mia verifica era cieca proprio su questo caso.** Controllava che
nella lista dei permessi non comparisse `anon=X` — ma **coi permessi
predefiniti quella lista è vuota**. Cercava la prova che la porta fosse stata
aperta *apposta*, e la porta era aperta *per difetto*.

⚠️ Il metro giusto è **`has_function_privilege`**, che chiede al database se
quel ruolo *può*, invece di leggere una stringa. E avevo perfino scritto nel
commento «nasce con gli stessi permessi predefiniti» **come se fosse una
rassicurazione**.

A prenderlo è stata `tests/app/permessi.test.js`, diventata rossa da sola —
esattamente il lavoro per cui era stata scritta il 13/08.

---

## Due reti hanno parlato, e una si sbagliava

- **`permessi.test.js`**: aveva ragione (sopra).
- **Il guardiano delle guardie**: **falso allarme**. Segnala la
  `20260828000013` come se riscrivesse la funzione, mentre **toglie solo un
  permesso** — non distingue un `revoke` da un `create or replace`.
  Dichiarato nella forma che lui stesso indica, **non aggirato**.

⚠️ **E il vincolo sull'identità dei documenti ha rotto una prova esistente**
che creava documenti senza data. **Corretta la prova, non il vincolo**: quelle
righe finiscono nella stessa tabella dei documenti veri.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta.

---

## Cosa NON è verificato

- 🔴 **Non ho rimesso i lavori pianificati sul progetto di prova.** Riaccendere
  la lettura automatica lì significa far leggere a MEMO delle mail finte, e
  **ogni giro si paga** — `posta-leggi` non guarda nessun tetto di spesa
  (misurato). È una decisione di Alessio, ed è la domanda 2.
- 🔴 **«Leggila adesso» non è mai stato premuto per davvero**: chiamerebbe il
  modello sulle mail di collaudo. Ho verificato che il pulsante compare, che
  la funzione è eseguibile dal titolare e rifiutata allo staff, non che il
  giro di lettura vada a buon fine.
- ⚠️ **«Letta da MEMO» compare anche su mail che MEMO non ha mai letto**: sul
  progetto di prova le proposte le ha scritte lo script dello scenario. Sul
  gestionale vero solo MEMO le scrive, quindi la frase è esatta là — qui è un
  artefatto dei dati di collaudo.
- ⚠️ **Nessuno ha guardato la Posta da un telefono vero** in questo blocco.
