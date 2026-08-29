# Le fatture, una lista per volta

**Blocco 4 del mandato del 29/08/2026 (pomeriggio).**
**Commit dichiarato: `4311799`** — working tree pulito al momento del commit.
**Migrazioni introdotte: `20260829000008` e `20260829000009`.**
⚠️ Applicate al progetto di prova, **non in produzione**: aspettano il push.

---

## Cosa abbiamo rovesciato

*Niente.* Il riquadro dei crediti in cima è **spostato**, non tolto: il
totale resta dove stava, sotto il numero grosso. Nessuna voce di
`docs/DECISIONI.md` è stata contraddetta; il quesito **L6** è stato
allargato con la terza domanda per Laura.

---

## ⚠️ Una premessa del mandato non reggeva

«Oggi sono in un elenco unico». Misurato: le due liste erano **già
separate** — «Da pagare» e «Pagate di recente» — ma stavano una sotto
l'altra, e sul telefono si scorre dentro le pagate cercando quelle da
pagare.

Adesso c'è l'**interruttore**, col conto sull'etichetta: «Da pagare (11)» /
«Pagate (22)». Senza il numero lì sopra, per sapere quante sono bisognerebbe
aprire la sezione — e chi apre «Pagate» per contarle ha perso di vista
quelle da pagare.

## L'ordinamento

Quattro voci — scadenza, importo, fornitore, data — e parte dalla
**scadenza**, che è la domanda con cui si apre questa schermata: *cosa devo
pagare adesso*.

## Il credito va dove serve

Il riquadro «Crediti da usare» stava in cima, elencava i crediti fornitore
per fornitore, e chiedeva a chi legge di **tenerli a mente** fino a quando
fosse arrivato alla fattura giusta.

Adesso lo dice la fattura stessa, **al momento di pagarla**, e dice che si
consuma tutto alla prima che paghi — Alessio ha scartato l'altra strada,
«mostrarlo solo sulla più vecchia», perché quella lo nasconde su tutte le
altre.

⚠️ Compare **solo sulle fatture da pagare**: su una già pagata sarebbe
un'informazione senza gesto.

## Il pulsante che si leggeva al contrario

Si chiamava «+ Registra una fattura a mano», e **Alessio l'ha letto come
«emetti una fattura a un fornitore»** e ha chiesto se avrebbe mai dovuto
farlo. Ora dice «**+ Aggiungi una fattura ricevuta**»: «ricevuta» dice da
che parte arriva il documento.

## Il regime di esonero

Casella sulla scheda del fornitore, e avviso quando si registra un acquisto
da uno di loro. Serve coi contadini e con l'ortofrutta locale: chi è in
esonero non emette fattura, e il documento lo deve fare Alessio — senza un
posto dove segnarselo si arriva a fine anno con venti autofatture mancanti,
e **l'assenza di un documento non produce nessun segnale da sola**.

⚠️ **Tre risposte, non una spunta.** «Non gliel'ho ancora chiesto» è lo
stato vero di **tutti e 11** i fornitori, ed è diverso da «no»: con «no» il
gestionale affermerebbe una cosa che nessuno ha verificato, e su un contadino
quella è l'affermazione che fa saltare l'autofattura. L'avviso **tace sul
dubbio**, per la stessa ragione: un avviso che compare nel dubbio si impara
a ignorare, e allora non avvisa più nemmeno quando serve.

⚠️ **Qui non si emette niente**: l'autofattura passa da Fatture in Cloud, che
Alessio non ha ancora attivato. Le percentuali e i tempi sono il quesito
**L6**, aperto — un numero fiscale scritto in una colonna prima che il
consulente risponda è un numero inventato che fra sei mesi nessuno ricorda
di aver inventato.

✅ **Provato nei due versi a schermo**: l'avviso compare col fornitore in
esonero e sparisce con un altro. Il fornitore è stato **rimesso com'era** —
11 su 11 tornati vuoti, contati.

## 🔴 «Tutte e 0», trovato guardando il caso vuoto

Il mandato chiedeva di verificare la schermata col caso «nessuna fattura», e
il difetto c'era: con un filtro che non pescava niente diceva «**Tutte e 0
che corrispondono ai filtri**» — e lo diceva **sotto** un «Nessuna fattura
pagata» che diceva già la stessa cosa, in italiano.

A marzo sarà il primo giorno del locale e questa schermata sarà vuota per
settimane: è lo stato in cui verrà guardata di più.

⚠️ Sul «da pagare» il conteggio **resta anche a zero** se c'è un filtro: «0
di 11» dice che le altre undici ci sono e le sta nascondendo il filtro —
senza, un elenco vuoto sembrerebbe un debito azzerato.

---

## Cinque reti diventate rosse da sole

Nessuna trovata da una rilettura. Tutte dopo il lavoro di oggi:

1. **`scarto_da_dire` era eseguibile con la sola chiave pubblica**, che sta
   nel pacchetto del sito. Non usciva nessun dato — è una funzione pura — ma
   *l'elenco di chi può bussare da fuori non deve crescere in silenzio*.
2. **`locale_aperto` e `si_lavora_in_cucina` scavalcavano i permessi senza
   portiere.** ⚠️ **La cura non è il portiere**: le tre tabelle che leggono
   hanno già la lettura aperta a chi usa il gestionale — verificato nelle
   policy, non dedotto — quindi si toglie `security definer` e **decide la
   RLS**. Il caso smette di esistere invece di essere sorvegliato.
3. **La colonna aggiunta oggi non era classificata** nel censimento delle
   unità: il giorno che un ingrediente cambia unità di misura sarebbe
   rimasta un numero in chili in mezzo a numeri in pezzi, **senza nessun
   errore**.
4. **Il vincolo sui giorni della settimana era muto**: rispondeva «violates
   check constraint», che in cucina non è un rifiuto — è un guasto.
5. **Una quinta rete ha preteso che la rimozione del `security definer`
   fosse dichiarata**, invece di lasciarla passare come una riscrittura a
   memoria.

⚠️ E la verifica della 2 controlla **anche il verso opposto**: che togliere
il `security definer` non abbia spento le funzioni in silenzio. Poteva
succedere, se le tabelle sotto non fossero state leggibili da chi chiama.

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine. **Nessuna
fattura è stata pagata**: «Segna pagata» non l'ho premuto, quindi
l'ordinamento e l'interruttore sono provati sulla lettura, non su un
pagamento vero. E **nessuna autofattura esiste**: l'avviso dice che va
emessa, ma che poi venga emessa non lo controlla niente.

**Cosa ho contato senza leggerlo.** Gli 11 fornitori e le 22 fatture pagate
vengono dalle etichette della schermata. Le cinque reti le ho lette
dall'esito delle prove, non riaprendo una per una le funzioni che
segnalavano.

**Quali mie affermazioni sono diventate false mentre lavoravo.** Nessuna in
questo blocco. In quelli precedenti, due — dichiarate lì.

**Quali conteggi sono pavimenti.** «Cinque reti»: sono quelle che hanno
segnalato in questo giro. Una rete che sorveglia qualcosa che oggi non ho
toccato non poteva dire niente.

**Cosa ho lasciato sul progetto di prova.** Le due migrazioni. Il fornitore
segnato in esonero per la prova è stato rimesso a vuoto e **ricontato**: 11
su 11.
⚠️ Ricaricando la pagina ho perso il riferimento che mi ero annotato nel
browser, e l'ho rimesso **a memoria del nome**. È andata bene perché ne
avevo toccato uno solo e me lo ricordavo: la prossima volta il marcatore va
tenuto fuori dalla pagina che si ricarica.
