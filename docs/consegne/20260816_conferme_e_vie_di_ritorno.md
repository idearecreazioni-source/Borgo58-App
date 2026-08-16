# Consegna del 16/08/2026 (nona) — Blocco 5 del mandato di correzione

**Commit della consegna: `0dcf51d`.** Questo riepilogo è il commit
immediatamente sopra, sola documentazione. Working tree pulito.

| Commit | Cosa |
|---|---|
| `0dcf51d` | le conferme dove servono, e le vie di ritorno — migrazione `20260816000009` |

⚠️ **Ordine seguito** (CLAUDE.md §2, regola 4): commit → push di Alessio →
`npm run migra -- --conferma` → questo riepilogo → secondo push. La
migrazione **`20260816000009` è già applicata in produzione** (§6).
Nessuna operazione nuova nel corridoio, **nessuna Edge Function
reinstallata**.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

Con questo, del mandato di correzione sono chiusi i **Blocchi 0-5**.
Restano il 6 (i registri che si esibiscono), il 7 (gli allergeni sul menu
stampato), l'8 (i fili scollegati), il 9 (il pagamento misto) e le
piccolezze.

---

## 1. Il censimento, e perché le conferme sono 14 e non 43

Fatto a mano su tutti gli 84 file `.jsx` di `src/pages` e
`src/components`: **52 punti distruttivi**, di cui **9 avevano già una
forma di conferma** e **43 partivano al primo click**.

> *«Non vanno messe tutte: una conferma su ogni gesto insegna a premere
> "sì" senza leggere, e allora non protegge più niente.»*

**Ne sono state messe 14** — l'elenco del mandato, uno per uno:

| Schermata | Cosa |
|---|---|
| `Cessioni` | una cessione intercompany (e il costo dell'ingrediente che torna indietro) |
| `ClienteDetail` | la scheda cliente |
| `PrimaNota` | un movimento di prima nota |
| `ScontiOmaggi` | uno sconto o un omaggio |
| `SezionePersonale` ×2 | una nota «di tasca mia»; **l'annullamento del suo rimborso** |
| `FattureFornitoriHome` ×2 | una fattura; **l'annullamento del pagamento** |
| `DeduzioniFiscali` | una spesa deducibile |
| `Mance` ×2 | una raccolta; una distribuzione |
| `DipendenteDetail` ×3 | un documento del dipendente; ferie; una busta paga |
| `AndamentoMensile` | la fotografia di un mese |

**Le 29 lasciate al primo click** sono quelle che il mandato mette in
categoria 2 — si rifanno in tre secondi o hanno una via di ritorno
visibile: righe di ricetta, fasi, video, voci di menu, colture, impegni
d'agenda, righe di comanda in bozza, righe della lista della spesa,
chiusure programmate, disattivazioni reversibili (causali, regole di
deducibilità, fornitori, bevande fuori carta), assegnazioni di tavolo,
annullamento di un ordine a fornitore (le righe tornano in lista).

⚠️ **Due esclusioni dichiarate, non dimenticate:**

- **«Buttata» sulle scadenze** (`Scadenze.jsx`): l'assenza di conferma è
  una **decisione già presa e commentata nel codice**, con l'avviso
  scritto sotto il pulsante. Non è un'omissione, e metterla ora sarebbe
  disfare una scelta di Alessio senza chiederglielo.
- **La raccolta propria** (`RaccoltaPropria.jsx`, registro HACCP): il
  mandato la tratta al **Blocco 6.2**, che chiede *conferma **e** traccia*
  insieme. Metà cura è peggio di nessuna — sembra risolto e non lo è.

**E la conferma dice cosa sparisce, coi suoi numeri.** «Elimino la
fattura #12 di Mililli da 240,00 €?», non «sei sicuro?». Un «sei
sicuro?» generico è una porta che si apre premendo due volte invece di
una: non aggiunge nessuna informazione a chi sta per sbagliare. La forma
è quella che «Elimina dipendente» usa dal 09/08 — il bottone si trasforma
sul posto, senza finestre che coprono ciò che si stava guardando —
raccolta in `src/components/ConfermaDistruttiva.jsx`. ⚠️ Su un tablet ha
un secondo vantaggio: **il tocco di conferma cade lontano dal primo**,
quindi non si conferma per inerzia.

---

## 2. Le sette vie di ritorno

Chiuse **dando il gesto che mancava**, non aggiungendo un avviso.

| Vicolo cieco | Cosa c'è ora |
|---|---|
| Fornitore disattivato | «Riaccendilo» sulla sua scheda — **e l'elenco fornitori mostra ora anche gli spenti**, altrimenti quel pulsante sarebbe stato in una schermata irraggiungibile |
| Prenotazione annullata | «Riprendi la prenotazione»: torna confermata, e i tavoli si riassegnano dalla pianta |
| Conto segnato scontrinato per errore | riquadro «Già segnati» con «Non era così» — il conto torna fra quelli da sistemare |
| Scadenza fissa chiusa | resta in elenco spenta e dichiarata, con «rimettila in elenco»; e l'importo si corregge sul posto |
| Mese fotografato per errore | «Rifalla» — vedi §3 |
| Periodi anomali | si creano e si tolgono da *Come sta andando* |
| Fattura / spesa deducibile sbagliata | numero, importo e descrizione correggibili sul posto |

⚠️ **Il fornitore non era solo un fastidio.** L'unico rimedio era crearne
uno nuovo con lo stesso nome — e da lì in poi lo **storico dei prezzi
sarebbe rimasto spezzato fra due fornitori**, cioè la sorveglianza dei
rincari avrebbe smesso di funzionare su di lui **senza dirlo**.

🔴 **I periodi anomali erano il caso peggiore, ed è un filo scollegato
vero.** Le funzioni esistono dal 14/08, l'app **mostra già** l'avviso «in
questo mese c'è un periodo segnato come…», e **nessuna schermata ne
creava uno**. Un avviso che non può mai comparire è peggio di nessun
avviso: dice che il gestionale se ne occupa, e non è vero.

⚠️ **Sulla fattura pagata l'importo NON si corregge**, e la scelta è
ratificata da Alessio come precedente per i casi analoghi: quel numero è
uscito dalla cassa, e cambiarlo lo scollegherebbe **in silenzio** dal
movimento che lo giustifica. Si annulla prima il pagamento. È la regola
del Blocco 1.

---

## 3. La condizione di Alessio sulla fotografia del mese

Alla domanda se il mese si potesse cancellare dalla schermata, la
risposta è stata sì **con due condizioni**, e la prima cambia la forma
della cura:

> *«Un mese rifatto deve vedersi. Se la fotografia di aprile viene
> cancellata e rifatta, la schermata deve dire che quel mese è stato
> rifatto e quando — altrimenti un numero che cambia passa in silenzio,
> che è la famiglia di difetti contro cui è nato tutto questo lavoro.»*
>
> *«E due gesti separati, non "cancella e rifai" in un colpo solo: prima
> si cancella, poi si rifotografa. Così non si sovrascrive per inerzia.»*

Quindi non bastava aprire la porta. Migrazione `20260816000009`:
`consuntivi_mensili` guadagna `chiusure_precedenti` e
`prima_chiusura_il`, e `chiudi_mese` li riempie.

⚠️ **Il fatto non si tiene con un contatore che qualcuno deve ricordarsi
di incrementare: si LEGGE dal registro delle cancellazioni**, dove le
fotografie cancellate già finiscono (`consuntivi_mensili` è fra le
tabelle sorvegliate). Un contatore separato sarebbe un secondo posto dove
vive la stessa verità — quello che questo mandato passa il tempo a
togliere.

⚠️ **Le colonne nascono NULLABLE**, e `null` vuol dire «non lo so»: è la
risposta vera per una riga arrivata da un ripristino vecchio, e scrivere
zero al posto suo sarebbe rispondere al posto di chi non c'era (lezione
del 14/08). In produzione di righe non ce n'è nessuna, quindi il punto è
teorico — ma è il modo giusto.

**I due gesti restano due**: rifotografare un mese senza averlo prima
cancellato è respinto, e **ricalcolarlo resta impossibile** — il sigillo
del 14/08 non è stato allentato, ed è verificato dentro la migrazione.

---

## 4. Cosa è stato verificato, e come

**Dentro la migrazione**, col ruolo vero del titolare, su un mese del
2019 (`chiudi_mese` rifiuta i mesi non ancora finiti, quindi serve una
data passata; il 2019 è prima che il locale esistesse):

| # | Controllo | Esito |
|---|---|---|
| 1 | La prima fotografia dichiara 0 chiusure precedenti e nessuna data anteriore | sì |
| 2 | Rifotografare senza cancellare prima | **respinto** |
| 3 | Ricalcolare un mese chiuso | **respinto** (sigillo del 14/08 intatto) |
| 4 | Cancellata e rifatta: dichiara 1 chiusura precedente **e la data vera della prima** | sì, entro 1 secondo |
| 5 | Un mese diverso non eredita il conteggio del vicino | sì |

La pulizia toglie anche le lapidi della prova dal registro delle
cancellazioni.

**Suite:** 20 pure + 111 sul progetto di prova, **tutte verdi**. Lint a
zero, build ok. **Idempotenza:** applicata due volte di fila sul progetto
di prova.

---

## 5. Cosa NON è verificato

- **Nessuna delle 21 schermate toccate è passata da una mano vera.** È il
  blocco che si vede di più usando il gestionale, ed è quello meno
  provato dal vivo: conferme, riquadri nuovi e campi correggibili sul
  posto esistono solo come codice compilato.
- **Il «rifatta» non è mai comparso su uno schermo**: in produzione non
  c'è nessun mese chiuso, quindi non c'è niente da rifare.
- **Nessuna delle vie di ritorno ha uno stato su cui esercitarsi**: zero
  fornitori spenti, zero periodi anomali, zero scadenze chiuse, zero
  conti marcati scontrinati. Sono tutte porte costruite su stanze vuote.
- **Le correzioni sul posto (fattura, spesa, scadenza) salvano
  all'uscita dal campo** — `onBlur`, non `<NotaSalvataAutomaticamente>`.
  ⚠️ È la trappola dell'08/08 (un campo che salva solo `onBlur` perde i
  dati se si ricarica col cursore dentro): qui il rischio è minore
  perché sono numeri corti e non testi lunghi, ma **è un debito
  dichiarato**, non una svista.
- **Il censimento è stato fatto a mano su `src/pages` e
  `src/components`**: se un'azione distruttiva vive altrove (un
  componente condiviso non `.jsx`, una schermata futura) non è nel conto.

---

## 6. I numeri veri dell'applicazione in produzione

```
applicate e registrate: 1 su 1
totale migrazioni in produzione: 116
mesi_chiusi: 0 | mesi_rifatti: 0 | fotografie_cancellate: 0
```

| Controllo (connettore in sola lettura, dopo) | Valore |
|---|---|
| Colonne nuove su `consuntivi_mensili` | 2, presenti |
| Mesi chiusi / rifatti / fotografie cancellate | 0 / 0 / 0 |
| Fornitori disattivati | 0 |
| Periodi anomali | 0 |
| Scadenze fisse chiuse | 0 |
| Funzioni di `public` eseguibili col solo `anon` | **12, invariate** |

**Nessun dato di Alessio è cambiato.**
