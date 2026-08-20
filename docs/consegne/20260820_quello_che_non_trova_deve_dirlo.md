# Quello che non trova quello che cerca deve dirlo — blocco A

**20/08/2026** · Code → validatore

- **HEAD dichiarato**: `33c9a201e78b6c998c97f67dfdca8a8fdf61e803`
- **Working tree**: pulito
- **Migrazioni**: **nessuna**. Al database non serviva niente: è tutto codice
  dell'app, prove e un comando di servizio.
- **Funzioni online**: nessuna toccata.

---

## Cosa abbiamo rovesciato

**Una riga sola, e stava in un commento.**

**Cosa era stato deciso, e quando.** In `src/lib/api/documents.js`, il 09/08,
la cancellazione di un documento toglieva **prima la riga e poi il file**, con
questa ragione scritta accanto: *«un file orfano è invisibile e innocuo, una
riga che punta a un file cancellato è un documento che l'app mostra e non si
apre»*.

**La ragione di allora.** È vera per metà, e la metà vera regge ancora: una
riga che punta a un file assente **è** un documento rotto in elenco.

**Cosa si decide adesso.** L'ordine è **invertito**: prima il file, poi la
riga. E il fallimento della rimozione **non si ingoia più** — se il file non
si toglie, la riga resta e chi ha premuto lo sa.

**Perché la ragione di allora non vale più.** La parola sbagliata era
**«innocuo»**, e a smentirla è una misura: nel deposito ci sono **13 file** e
**3 che nessun documento nomina più**. Non sono innocui — sono documenti che
Alessio ha cancellato **credendo di averli tolti**, e che dall'app non si
possono più nominare. E «invisibile» era esatto: è il motivo per cui ci sono
voluti dieci giorni per accorgersene.

⚠️ **Non esiste una transazione fra database e deposito**: sono due sistemi
diversi, quindi se il secondo passo fallisce qualcosa resta a metà **in tutti
e due gli ordini**. Non si sceglie fra «tutto o niente» e «metà»: si sceglie
**quale metà** — e quella nuova **si vede** e **si ripara da sé** al tentativo
successivo, perché togliere un file già assente non dà errore.

---

## A1 · Una regola sola, non cinque toppe

Il difetto in una frase: **`.catch(() => [])` trasforma «non sono riuscito a
leggerlo» in «non c'è niente»**, e a schermo le due cose si leggono uguali.

La regola vive in **un posto solo**, `src/lib/calcoli/letture.js`:

- `leggi(promessa)` sostituisce i catch che ingoiavano — **non fa cadere le
  letture accanto** (che è la ragione per cui esistevano) ma conserva
  l'informazione invece di buttarla;
- `NON_LETTO` è il segno, un oggetto congelato e **non `null`** — `null` è già
  un valore legittimo in mezzo gestionale, e confonderli riaprirebbe il difetto
  da un'altra porta;
- `statoLettura()` dà **tre** risposte: `non_letto`, `vuoto`, `pieno`. Prima le
  prime due erano lo stesso `[]`.

⚠️ **La decisione è separata dal disegno, apposta.** In questo progetto le
prove non hanno un ambiente DOM, quindi **nessuna prova automatica può
guardare una schermata**. Separandola, quello che si può provare è *quale
delle tre cose la schermata dirà* — che è dove il difetto vive. Stesso taglio
di `segnoDelTavolo()` per i colori della sala.

### La forma a schermo, in un componente solo

`<DatoNonLetto>` riusa **la forma già in servizio dal 18/08** in Comande e nel
Calendario: non se ne inventa una terza. Due varianti, e la differenza è chi
legge:

- **col pulsante Riprova** dove il dato *è* la schermata;
- **una riga sottile** per un menu o un accessorio — *un riquadro con pulsante
  ripetuto quindici volte diventa arredamento, e l'arredamento non lo legge
  nessuno* (il criterio «essenziale e minimal» di Alessio).

### I cinque punti misurati dal validatore, chiusi

| dove | cosa si leggeva prima |
|---|---|
| Magazzino, «cosa non è sceso» | il riquadro spariva: **indistinguibile da «è sceso tutto»**, con sotto una giacenza più alta del vero |
| Lista della spesa, sotto scorta | la lista si apriva **corta e sembrava completa** — il difetto che il commento tre righe sopra dichiarava chiuso |
| Cassa e «Ce la faccio?», uscite future | il saldo **sembrava pulito** |
| Sezione personale, fatture da pagare | menu vuoto → si registra la nota come spesa a sé, cioè **la stessa spesa contata due volte** |
| Andamento mensile, imposte | «non ci sono conti da sistemare», cioè una stima **già affidabile** |

### E altri otto trovati guardandoli uno per uno

Ricettario (le altre versioni di un prodotto → da lì nasce un **doppione** in
anagrafica), Registra carico (le righe di lista → il carico non chiude la riga
della spesa), Posta in arrivo (ingredienti e fornitori → **è il difetto del
12/08 con un'altra causa**), Archivio (le società → si archivia senza società;
il numero della posta in attesa), Chiedi all'archivio, Fornitore (le regole di
deducibilità), Previsione (la previsione dell'anno prima → *«giugno sembra più
leggero»*), Preventivo (i piatti → menu vuoto **davanti a un cliente**), e
l'avviso delle trattative aggiunto stamattina.

### I silenzi che restano, dichiarati e sorvegliati

**Due**, e la ragione è scritta nel codice col marcatore `SILENZIO MOTIVATO`:

- **`giornataOperativa.js`** — senza l'ora di fine serata la schermata dice **di
  meno** (non dichiara la serata) invece di affermarla su un'ora che nessuno ha
  detto. Non tace: dice meno;
- **il modulo pubblico** — senza le opzioni torna all'orario libero, che è uno
  stato dichiarato della pagina. ⚠️ E il destinatario è **un ospite**: una riga
  tecnica lì non gli servirebbe a decidere niente.

### La rete

`tests/unita/letture.test.js`: ogni `.catch(() =>` di `src/` o marca
`NON_LETTO`, o dichiara perché tace. **E l'elenco dei silenzi dichiarati è
congelato**: chi ne aggiunge uno lo nomina lì — la stessa forma delle funzioni
aperte ad anon.

⚠️ **Limite dichiarato**: è un controllo di **forma**, non di comportamento.
Non sa se la schermata mostra davvero la riga; sa che quel punto non è stato
lasciato muto. Il caso che resta possibile — marcare e non guardare mai — lo
prende una mano.

**Rotto tre volte, rosso tre volte**: un catch che ingoia (dice **quale file e
quale riga**), le tre risposte tornate due, un silenzio che smette di
dichiarare la ragione.

---

## A2 · Il file che restava nel deposito

Oltre all'inversione dell'ordine (sopra), c'è **`npm run deposito:orfani`**: in
sola lettura come `npm run migra`, dice quanti file ci sono, quanti sono
nominati e quali no. Con `-- --conferma` li toglie, **rimisurando dopo** invece
di dichiarare «fatto».

✅ **Misurato in produzione stasera**: 13 file, 10 nominati, **3 orfani** — gli
stessi tre del validatore. ⚠️ **Non tolti**: stasera non si tocca la produzione.

🔴 **E due dei tre sono documenti VERI**, non di collaudo:
`AA7_attribuzione_Partita_IVA.pdf` e
`Locazione_Parlato_Borgo58-10.08.2026.odt`. Vanno nominati ad Alessio **prima**
di togliere qualunque cosa dal deposito — vedi la domanda in fondo.

⚠️ **E una misura che serve a chi scriverà il prossimo script**: in questo
progetto **`service_role` non ha il permesso di leggere le tabelle di
`public`** — ce l'ha solo `authenticated`, con la RLS sopra. È una postura
difensiva voluta, e il comando legge l'archivio da `psql`.

**Provato in entrambe le direzioni** (`tests/unita/cancellazione-documento.test.js`):
il file si toglie → la riga si cancella, **e in quest'ordine**; il file non si
toglie → **la riga resta** e il messaggio dice cosa è successo, cosa fare e il
motivo vero.

🔴 **La prima rottura non è servita a niente**: aveva prodotto un **errore di
sintassi** invece del difetto, quindi non misurava nulla. Rifatta pulita:
tornando all'ordine vecchio diventano rosse **tre** prove su quattro.

---

## A3 · Le prove che si spengono da sole

- **il numero si conta**: `proveCondizionate()` legge il sorgente. Il messaggio
  vecchio diceva «le tre prove del corridoio» — erano tre quando è stato
  scritto;
- **il salto si denuncia da ognuno dei nove file**: `denunciaSaltiCorridoio()`
  chiamata in cima a ciascuno. Prima chi lanciasse un singolo file col
  corridoio spento vedeva prove «passate» che non erano mai partite.

🔴 **E la prova al contrario ha trovato che il conteggio del validatore era
incompleto**: `allarmi.test.js` salta un `describe` **intero**, non le singole
prove — cercando solo `it.skipIf` risultava «zero» su un file che ne salta tre.
Ora ne riconosce **due forme**. *È la stessa lezione del 19/08 sul guardiano
che riconosceva una sola delle due scritture dello stesso gesto.*

🔴 **E una seconda rottura ha trovato un difetto nella mia prova**: cercava il
**nome** `denunciaSaltiCorridoio`, che resta anche togliendo solo la chiamata e
lasciando l'import. Passava verde su un file che non la chiamava più. Ora cerca
la **chiamata**.

Il censimento vivo: 25 `it.skipIf` su otto file + un `describe.skipIf` che ne
copre tre. ⚠️ **Nessuno di questi numeri è scritto in una prova**: quello che
si afferma è una proprietà — *se esistono prove condizionate, esiste chi le
denuncia*.

---

## 🔴 Il difetto che nessuno aveva chiesto di cercare, e che bloccava la suite

Facendo girare tutto, **`scarico-magazzino.test.js` andava in timeout e le sue
sei prove risultavano SALTATE**. Misurato invece di riprovare:

- sul progetto di prova c'erano **74 ingredienti `TEST-AUTO scarico`**;
- li tratteneva `stock_consumptions` con un vincolo `restrict`;
- e la pulizia della prova **credeva di cancellarli**: `stock_consumptions` ha
  **una sola policy, quella di lettura** (decisione del 16/08, esplicita). Dal
  client quel `delete` **non cancella niente e non dà errore**.

⚠️ **È la stessa famiglia del blocco A, vista dal lato delle prove**: qualcosa
che non trova quello che cerca e continua zitto. Per dieci giorni ogni
esecuzione ne ha lasciato uno, finché la pulizia ha sforato i 30 secondi
dell'hook — e a quel punto **sei prove hanno smesso di girare senza diventare
rosse**.

⚠️ **La cura NON è stata aprire la policy.** *Una prova che allarga un permesso
per potersi ripulire è il primo passo verso una che lo lascia aperto.* Ci si è
girati attorno: l'ingrediente si **riusa** invece di crearne uno nuovo — come
questo stesso file già faceva col tavolo — così il residuo resta uno.

I 73 di troppo sono stati tolti dal **progetto di prova** (usa-e-getta, §2 di
CLAUDE.md). Da 60 secondi a **5**, e due esecuzioni di fila non lasciano
residui nuovi.

---

## I numeri

| | |
|---|---|
| prove pure | **168 passate**, 0 saltate *(erano 152)* |
| prove sui dati veri | **273 passate**, **0 saltate** *(erano 265 + 6 saltate)* |
| lint | zero avvisi |
| punti di lettura curati | **13 file** |
| silenzi motivati rimasti | **2**, dichiarati e congelati |
| file orfani in produzione | **3**, misurati, **non tolti** |

---

## Cosa NON è verificato

- 🔴 **Nessuna mano ha visto nessuna delle righe «non lo so»**, e non è una
  dimenticanza: **questo progetto non ha un ambiente DOM per le prove**, quindi
  nessuna prova automatica guarda una schermata. Quello che è provato è la
  decisione e la forma del codice. **Il criterio 1 del mandato — «una lettura
  fatta fallire di proposito produce a schermo una riga che lo dice» — è
  soddisfatto per la metà che si può provare senza una mano.** Vedi la domanda
  in fondo.
- **I 3 file orfani sono ancora nel deposito**: il comando c'è, la rimozione no.
- **La cancellazione di un documento non è stata provata dal vivo** contro lo
  storage vero: le prove sono sul contratto della funzione.

---

## DA CONFERMARE AD ALESSIO

1. **Un ambiente DOM per le prove.** Oggi nessuna prova può guardare una
   schermata, e tre difetti grossi in tre giorni li ha trovati **una mano o una
   fotografia**. Aggiungerlo è una **dipendenza nuova** e una decisione
   architetturale: non l'ho presa. *Se sì*: le righe «non lo so» diventano
   provabili, e con loro tutta l'interfaccia. *Se no*: restano provate a metà,
   e ogni volta serve un occhio al collaudo.
2. **I due documenti veri nel deposito.** Fra i tre file orfani ci sono la
   **partita IVA** e il **contratto di locazione**. Il blocco D li darebbe per
   cancellabili perché li tieni altrove: **prima di togliere qualsiasi cosa dal
   deposito va confermato che ce li hai ancora**. *Se sì*: si tolgono col resto.
   *Se no*: si scaricano prima.
