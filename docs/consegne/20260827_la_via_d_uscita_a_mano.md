# La via d'uscita a mano, e il guardiano che non guardava — 27/08/2026

**HEAD dichiarato**: `b10b45a` — «Ogni riga in sospeso ha la sua via d'uscita
a mano». Questo riepilogo è l'ultimo commit della consegna e sta sopra di lui.

Ogni affermazione con un numero porta **(vero)** se misurata sul gestionale
di Alessio o sui suoi transcript, **(prova)** se sul progetto di prova.

---

## 0. IL GUARDIANO APPESO — arrivato per primo, e ha corretto sé stesso

Segnalato da Alessio: un'attività in sottofondo ferma da 13 ore.

**Cosa aspettava** (prova, misurato): il comando era

```
until grep -q "Test Files" /tmp/app.log; do sleep 15; done
```

partito alle **02:06:50** del 27/08 e ancora vivo alle **15:13** — circa
**3.150 giri a vuoto**.

**Perché non finiva** (prova): `/tmp/app.log` è fermo a **3.967 byte scritti
alle 02:06** e contiene un solo messaggio — `Startup Error: Failed to load
custom Reporter from basic`. Chi l'aveva lanciato passò `--reporter=basic`,
che in **vitest 4.1.10** non esiste più. Vitest è morto in due secondi, e la
parola attesa non poteva più arrivare.

Il processo è stato **chiuso** dopo aver capito cosa aspettava.

### 🔴 LA MIA PRIMA CONCLUSIONE ERA SBAGLIATA, e va detto prima del resto

Avevo scritto — e Alessio l'ha ripreso come premessa — che *«quella notte le
prove sull'app non sono girate, e il silenzio è stato letto come conferma»*.

**È falso, e i log lo dimostrano** (prova, i file erano ancora sul disco):

| ora | file | esito |
|---|---|---|
| 02:06 | `/tmp/app.log` | morto all'avvio — è il guardiano appeso |
| **02:22** | `/tmp/app2.log` | 1 rossa su 427 |
| **02:29** | `/tmp/app3.log` | **427 verdi su 427** |
| 02:31 | — | commit del riepilogo |

La sessione **ha abbandonato quel guardiano e ha rilanciato le prove undici
minuti dopo**. Il riepilogo delle 02:31 dichiara «le 494 prove pure e le
prove sull'app: ho letto il totale del comando» — ed **era vero**, riferito
al giro delle 02:29.

Il «**432 su 432**» compare solo nei riepiloghi delle **11:56** e **13:15**
di oggi, e anche quello è vero: `/tmp/app7.log`, 13:12, 432 verdi.

⚠️ **Quello che resta è un residuo, non una consegna falsa**: un processo
morto lasciato a girare, e nessuno che l'abbia chiuso.

⚠️ E la lezione su di me è più utile del difetto: *un fatto vicino alla causa
non è la causa*, ed è la seconda volta in due giorni. La verifica costava due
minuti — guardare se il lavoro era stato rifatto per un'altra strada.

### Da quando `--reporter=basic` (vero, dai transcript)

**Una volta sola**: `2026-08-27T00:06:43Z` (02:06 italiane), sessione
`a0b4fee5`. Nessun'altra sessione l'ha mai usato. **Una sola consegna
coinvolta**, e quella consegna aveva comunque le prove verdi da un rilancio.

### La famiglia (vero, 38 condizioni d'attesa distinte dal 18/08)

| | quante |
|---|---|
| 🔴 aspettano solo la parola del **successo** | **13** — 4 il 18/08, 2 il 22/08, **7 il 27/08** |
| ✓ la condizione copre anche il fallimento | **25** |

⚠️ **Nel codice del repository la forma malata non c'è**: i quattro
`setInterval` sono battiti d'orologio e ricariche periodiche. La famiglia
vive **solo nei comandi di sessione**.

🔴 **E il primo setaccio che ho scritto per contarle sbagliava**: classificava
malato `until grep -q "EXIT="`, che è sano perché quel marcatore lo stampa
chi lancia (`echo "EXIT=$?"`) e compare qualunque sia l'esito. Il metro
corretto è stato **provato prima su quattro casi di risposta nota**; i due
conteggi differiscono di **25 righe**.

### La dimostrazione chiesta (prova, eseguita)

Sullo stesso comando morto, due guardiani:

```
GUARDIANO MALATO  → ...giro 4: ancora niente. (non finirebbe MAI)
GUARDIANO SANO    → 🔴 IL PROCESSO SORVEGLIATO È MORTO (uscita 1).
                      Le prove NON sono girate.
```

**Il difetto non è l'attesa: è il silenzio.** Un guardiano che non risponde è
indistinguibile da uno che sta lavorando.

---

## 1. OGNI RIGA IN SOSPESO HA UNA VIA D'USCITA A MANO

**Decisione di Alessio**, sue parole: *«se ti dico segna trenta euro pagati al
fornitore, mi aspetto che un collegamento mi porti dove si segnano le spese,
coi campi noti già compilati, e io aggiungo solo il nome del fornitore che ho
omesso»*.

### Le schermate sono DIECI, non «sei o sette» (misurate)

Undici tipi di comando vocale, dieci con una destinazione:

| tipo | dove porta |
|---|---|
| giacenza | `/magazzino/allineamento` |
| temperatura | `/haccp/temperature` |
| promemoria | `/agenda/nuovo` |
| pulizia | `/haccp/pulizia` |
| lista_spesa | `/magazzino/lista-spesa` |
| merce_buttata | `/magazzino` |
| movimento_cassa | `/cassa/prima-nota` |
| carico_merce | `/magazzino/carico` |
| prodotto_nuovo | `/ricettario/ingredienti/nuovo` |
| ricetta | `/ricettario/ricette/nuova` |
| **nota_non_capita** | **nessuna, apposta** |

🔴 L'undicesima non ha destinazione perché vuol dire «non ho capito cosa
volevi». *Mandare da qualche parte chi non sa dove sta andando è peggio che
non mandarlo.*

### Il telaio, cercato prima di insegnarle una per una

Come per i 18 moduli della Dashboard, il lavoro è **uno solo**:

- `src/lib/calcoli/aMano.js` — le regole pure (l'indirizzo, e `conCampi` che
  applica quello che si è capito **senza cancellare** quello che non si è
  capito);
- `src/lib/daVoce.js` — l'hook `useDaVoce`;
- `src/components/StriscaDallaVoce.jsx` — la striscia che spiega perché i
  campi sono pieni.

Per schermata restano **quattro righe**: una mappa dichiarativa, l'hook, la
chiusura dopo il salvataggio, la striscia.

⚠️ **L'unico pezzo che NON può essere comune** è la mappa: il database
restituisce nomi leggibili («importo», «verso»), ogni modulo usa i propri. Una
mappa globale sarebbe una seconda definizione di cosa contiene quel modulo.

### Nell'indirizzo va solo l'identificativo

`/cassa/prima-nota?daVoce=<id>` — e i campi li chiede la schermata al
database. Tre ragioni: importi e nomi di fornitori non finiscono in una query
string; la schermata non può ricevere valori diversi da quelli dell'azione;
l'identificativo serve comunque per chiudere la riga.

### 🔴 Lo stato «fatta a mano», e il difetto che chiude

Nessuno dei quattro stati esistenti andava bene: `annullata` vuol dire «ho
detto di no», `eseguita` vuol dire «l'ha fatta il gestionale».

**Se la riga non si chiudesse**, resterebbe in sospeso dopo essere stata
fatta, e la volta dopo Alessio la ridice a voce o preme «Sì, fallo»: **la
stessa spesa in cassa due volte**. Per questo `esegui_azione_dettata` la
rifiuta — *«farla di nuovo la scriverebbe due volte»* — e il rifiuto sta nel
**database**, non nel pulsante spento: la schermata con la riga vecchia può
essere rimasta aperta altrove.

### La mappa sta nel database, e la ragione è una rete

`tipi_vocali_senza_uscita()` è la gemella di `tipi_vocali_senza_ramo()`, nata
il 27/08 dopo che **quattro tipi accesi erano rimasti senza esecuzione** per
giorni. Una mappa in JavaScript non la guarda nessuna migrazione.

**Provata rompendola** (prova): messo un tipo finto senza percorso, la rete lo
nomina; senza, dice zero.

### Provato con le mani, sul progetto di prova (prova)

Apparecchiata una riga in sospeso «ho pagato trenta euro al fornitore»:

1. su `/detta` compare **«Fallo a mano, coi campi già compilati →»**;
2. porta a `/cassa/prima-nota?daVoce=…`;
3. la prima nota si apre con **importo 30**, verso **Uscita**, mezzo
   **Contante**, giornata **27 ago 2026** — e **causale vuota**, che è il
   pezzo da aggiungere;
4. in cima: *«Stai finendo a mano una cosa che avevi detto: “…”»*;
5. salvato: contante da **−25.721,66** a **−25.751,66** — **30,00 esatti**;
6. la striscia diventa **«✓ Fatto. La cosa che avevi detto non aspetta più»**;
7. tornando su `/detta` l'elenco è **vuoto**.

**Chiesto al database, non allo schermo** (prova): stato `fatta_a_mano`, ora
scritta, e **un solo** movimento da 30 euro.

**Misure a tre densità** (prova, DOM): bersaglio **10,50 mm**, testo **3,20
mm**, sbordo **zero**, nessuno scorrimento laterale — a `--pxcm` 37,8, 59,5 e
**64** (il valore di un mini tablet). È una **proprietà**, non una quantità.

Dati di prova **cancellati per identificativo**: zero azioni, zero dettature,
zero movimenti da 30 (prova).

### Le due porte trovate dalla rete, non rileggendo

`tests/app/permessi.test.js` è diventata rossa da sola: **23 attese, 25
trovate** (prova). Le due nuove erano nate un'ora prima.

- **`azione_campi`** → **porta chiusa**, nessun portiere: la chiama solo
  `azione_a_mano`, che il portiere ce l'ha. ⚠️ E la porta non era teorica:
  dentro legge `suppliers`, quindi aperta esponeva i nomi dei fornitori.
- **`tipi_vocali_senza_uscita`** → **portiere**, come le altre diagnostiche.

🟡 **Resta da guardare, dichiarato**: la gemella `tipi_vocali_senza_ramo()` il
portiere **non ce l'ha**. Due gemelle con due trattamenti diversi sono la cosa
che fra sei mesi qualcuno «uniforma» senza sapere perché. Non l'ho toccata:
misurare chi la chiama è fuori dal perimetro di questo blocco.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore è stata cambiata. Le voci di
`docs/DECISIONI.md` toccate sono **tre**, tutte in aggiunta o conferma:

- *«Ogni cosa rimasta in sospeso deve avere DUE uscite»* (27/08): la riga
  **NON ANCORA COSTRUITO** è diventata ✅ **costruito**;
- aggiunte le due decisioni nuove di oggi (il nome «fatta a mano», e il
  collegamento su tutte le schermate insieme).

E una decisione in vigore è stata **rispettata invece che scavalcata**: la
lista della spesa riceve sempre un **nome libero** e non tocca mai
`ingredient_id`, perché *«non cerca affatto»* (27/08).

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: tutto ciò che è «visto» è **letto dal DOM**.
- **Niente da un telefono vero**: la larghezza è emulata a 375 punti e le
  densità sono forzate via CSS, non misurate su un tablet in mano.
- **Nove schermate su dieci non le ho aperte**: ho guardato con le mani solo
  il giro della **prima nota**. Sulle altre nove il collegamento è provato dal
  database e dalle prove automatiche, **non premuto**.
- **Nessuna riga chiusa a mano da una dettatura vera**: la riga di prova
  l'ho scritta io in tabella, non parlando.

**Cosa ho contato senza leggerlo**
- Le **437 prove sull'app** e le **505 pure**: ho letto il totale.
- Le **38 condizioni d'attesa** nei transcript: contate da uno script, e
  **classificate da un metro che ho dovuto correggere una volta**.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 *«Stanotte le prove sull'app non sono girate»*: **falso**, e l'ho
  scoperto solo cercando i log dei rilanci. Corretto in §0.
- *«Le schermate sono sei o sette»* (dal mandato): sono **dieci**.
- *«Il primo giro di prove è rosso su `permessi`»*: vero, **e curato**.
- *«Il giro finale è rosso su 41 file»*: **falso** — avevo lanciato due giri
  in parallelo sullo stesso database di prova, che è una regola nota del
  progetto violata da me. Rilanciato da solo: **437 su 437**.

**Quali blocchi non ho aperto**
- **Blocco 2** (MEMO), **Blocco 3** (il pollice), **Blocco 4** (la pagina che
  si ricarica). Nessuno dei tre è stato toccato.

**Prove**
- pure: **44 file, 505 prove** (uscita 0)
- app: **62 file, 437 prove** (uscita 0), sul progetto di prova
- lint: **zero avvisi**; build: verde
- 11 prove pure nuove + 5 sull'app, **provate per rottura**: due rotture
  diverse producono due gruppi di prove rosse diversi.

**Migrazioni**
- repository: **286**; produzione: **270**; progetto di prova: **286**.
- **Sedici in attesa del push**: le tredici di prima più
  `20260827000012`, `…013`, `…014`.
- Ordine: `git push` di Alessio → `npm run migra -- --conferma` → riepilogo →
  secondo push.

**Trappole nuove** (§8 di `CLAUDE.md`): cinque — il guardiano che aspetta una
parola; il fatto vicino che non è la causa (anche quando la premessa arriva da
chi chiede); il lint verde che non dice che compila; la ricerca multi-riga
contro i fine riga CRLF; «il corpo vivo» che dipende da quale database si
guarda.

---

## Da guardare, dichiarate e non chiuse

1. 🔴 **Sulla porta 5199 gira un server puntato alla PRODUZIONE** (vero,
   misurato: serve il riferimento del gestionale vero). È la porta di
   `npm run dev:collaudo`, che dovrebbe essere il progetto di prova: è stato
   avviato a mano con `npx vite --port 5199`, che legge `.env.local`. **Non
   l'ho fermato** (è condiviso con Alessio) e ho aperto una porta mia.
2. 🟡 `tipi_vocali_senza_ramo()` senza portiere, mentre la gemella ce l'ha.
3. ⚠️ La pulizia della prova a schermo ha lasciato **una lapide** in
   `deleted_records` sul progetto di prova (`cash_movements` è tracciata).
