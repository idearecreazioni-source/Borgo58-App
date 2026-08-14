# Borgo 58 — Mandato cumulativo (agosto 2026)

**Origine**: validatore, 14/08/2026, su decisioni di Alessio discusse e verbalizzate una per una. Raccoglie sei blocchi indipendenti fra loro, da eseguire **uno alla volta** nell'ordine che le dipendenze consentono.

**Rapporto con i mandati già in corso**: questo mandato viene **dopo** *Produzioni* e *Proiezione economico-fiscale* (il magazzino che scende è già fatto). Il **Blocco 2 (voce)** dipende dalla dettatura push-to-talk del *Ricettario Fase 1*: senza quella non parte. I Blocchi 1, 3, 4, 5, 6 sono indipendenti e possono partire quando c'è spazio.

**Consegna**: un blocco per volta, riepilogo in `docs/consegne/`, regole di `CLAUDE.md` §2. Prove distruttive solo sul progetto di prova. Le decisioni non previste qui si fermano da Alessio prima.

---

## Blocco 1 — L'Agenda ridisegnata

Oggi è un elenco piatto con tre filtri (cerca, priorità, stato) che non rispondono alla domanda vera: *cosa devo fare adesso*. Cinque impegni su venti sono senza scadenza e di fatto invisibili. Il disegno approvato:

1. **Quattro corsie** al posto dell'elenco unico, in quest'ordine: **In ritardo** (in cima, sparisce se vuota) · **Questa settimana** raggruppata per giorno con etichette parlanti (*Oggi*, *Domani*, *Giovedì 20*) · **Più avanti** chiusa a fisarmonica, per mese · **Quando capita** (senza scadenza).
2. **Il calendario diventa la seconda scheda**, non la prima.
3. **Categorie chiuse**, non testo libero (oggi ci sono già quattro convenzioni diverse su venti righe): *Fisco e scadenze · Documenti · Fornitori e pagamenti · Personale · HACCP e locale · Altro*. Automatiche per i promemoria generati dai moduli, a tendina per quelli scritti da Alessio. Migrazione che riporta dentro le diciture attuali.
4. **Priorità calcolata, non dichiarata**: l'urgenza viene dalla scadenza; resta una **stella** manuale per "questo per me conta". I tre livelli attuali spariscono.
5. **Provenienza visibile e cliccabile**: etichetta *"da Archivio documenti"* / *"da Posta"* e un tocco che apre il record d'origine.
6. **Tre gesti dalla lista, senza aprire la scheda**: **fatto** (spunta), **rimanda** (a una data), **promuovi a data** (dalle voci senza scadenza).
7. **"Quando capita" non deve diventare un cimitero**: mostra da quanto tempo una voce è lì ("in lista da 3 mesi") e **non entra mai nel badge del modulo**.
8. **Badge del modulo = solo ritardo + oggi.** Un numero fermo su venti smette di essere un'informazione.
9. **Ricorrenze**: chiudendo un impegno ricorrente nasce il successivo.

**Criteri di accettazione**: le quattro corsie mostrano le righe giuste con dati veri; i cinque impegni oggi senza scadenza compaiono in "Quando capita" con l'anzianità; il badge conta solo ritardo+oggi; rimanda e promuovi funzionano dalla lista; una ricorrenza chiusa genera la successiva; nessuna categoria libera residua.

## Blocco 2 — L'interfaccia vocale *(dopo Ricettario Fase 1)*

**Una sola bocca, una sola orecchia.** Il bottone push-to-talk del Ricettario è l'unico ingresso vocale: cambia il bersaglio, mai il meccanismo. Vincoli confermati da Alessio:

- **Mai microfono sempre acceso, mai parola di risveglio.** Audio non conservato: resta solo il testo interpretato.
- **La voce risponde e conferma, non annuncia mai di sua iniziativa.** Nessun annuncio non richiesto — gli avvisi vocali si valuteranno separatamente dopo l'apertura. Questo è un vincolo, non una preferenza.
- **Voce cloud** (più naturale della voce di sistema): chiave nei Secrets di una Edge Function — segreto B2, stampo Telegram — sotto lo stesso tetto di spesa dell'account AI. **Nessun limite di lunghezza per ora**, ma ogni consegna riporta il **costo reale per risposta parlata**: dopo una settimana di uso vero si decide con i numeri.
- **Interruttore per zittire la voce** senza perdere la dettatura.
- **Date parlate risolte sulla data locale**, mai universale (classe di difetto già vista due volte).
- **Propone, non salva**: si vede la bozza e si conferma.

**Bersagli, in ordine di valore:**
1. **Temperature HACCP a giro** — più valori in una frase (*"frigo 1 quattro gradi, frigo 2 cinque, abbattitore meno diciotto"*), agganciati alle attrezzature registrate, **una conferma sola per tutti i valori**. Un valore **fuori range non si salva mai a voce e basta**: apre la procedura di non conformità con il rimedio, esattamente come da schermata.
2. **Prenotazione tavolo** (*"prenota per domani alle 21 a nome X"*): passa **dagli stessi controlli del form pubblico** (orari, posti liberi, preavviso) — se non c'è posto, lo dice e non prenota. Il **nome va confermato a video** (la prova sul campo ha misurato: numeri sempre giusti, errori sulle parole); il **telefono si digita**, perché una cifra sbagliata rompe l'aggancio alla scheda cliente.
3. **Inventario cantina, sprechi e rotture, ricevimento merci, pulizie del piano di autocontrollo.**
4. **Produzioni, lista della spesa, promemoria in Agenda, dettatura ricette** (bersagli già previsti dai rispettivi mandati).
5. **Chiedere, non solo dettare**: giacenze, coperti di stasera, cosa scade — sola lettura, motore già esistente ("chiedi all'archivio").

**Fuori perimetro, dichiarato**: comande in sala (rumore + costo dell'errore sul servizio); qualunque cosa muova denaro o sia irreversibile senza un tocco di conferma.

**Criteri di accettazione**: giro temperature completo a voce con conferma unica; un fuori range che apre la non conformità e **non** si chiude a voce; prenotazione rifiutata quando non c'è posto; costo per risposta parlata misurato e riportato; interruttore che zittisce la voce lasciando viva la dettatura; nessun percorso in cui la voce parli senza input.

## Blocco 3 — Cantina e bevande

Oggi il gestionale sa solo **come si vendono** i vini (carta: nome, produttore, servizio, prezzo). Non esistono giacenze, costo, margine, fornitore. Decisioni di Alessio:

1. **Stessa macchina del magazzino**, non un modulo parallelo: lotti, carico dalla fattura, scarico dalla comanda, sorveglianza rincari. Una cantina separata divergerebbe.
2. **Mescita al calice: sì.** Serve il numero di calici per bottiglia (lo fornisce Alessio) → costo del calice e **sfrido della bottiglia aperta non finita**. Servono i gesti di sala **"bottiglia aperta"** e **"bottiglia buttata"**, altrimenti il fondo scartato resta invisibile.
3. **Annate non gestite separatamente**: una riga per etichetta, costo all'ultimo prezzo pagato (coerente con la regola del cibo). **Porta lasciata aperta**: l'annata dovrà poter diventare un campo del *lotto* in futuro senza rifare nulla.
4. **Cocktail come ricette**: dosi di distillati nel Ricettario, che già le regge.
5. **Inventario fisico ogni 3 mesi**: la rettifica **non corregge in silenzio** — mostra lo scostamento fra sistema e scaffale, **in bottiglie e in euro**. È la misura di ciò che sfugge.
6. **Valore della cantina** (capitale immobilizzato) disponibile per la Proiezione economica.

**Criteri di accettazione**: una fattura di vino entra dalla stessa porta di una fattura di cibo; il costo del calice torna col calcolo manuale; una bottiglia aperta e non finita produce sfrido visibile; l'inventario mostra lo scostamento nelle due unità; nessun secondo sistema di giacenza.

## Blocco 4 — Fatture in Cloud, nelle due direzioni

**Prerequisito di Alessio**: attivazione del piano Complete e accesso OAuth (decisione e costo suoi). Il segreto OAuth è condizione B2 → Edge Function; un eventuale webhook è B3.

1. **In entrata** — fatture d'acquisto via API. Il terreno è già preparato: la logica di abbinamento riga↔ingrediente sta nel database proprio perché domani il carico arrivi da qui senza divergere. **Regola anti-duplicato obbligatoria**: la stessa fattura può arrivare anche via email — Fatture in Cloud è la fonte di verità, il doppione dalla posta si scarta senza rumore, con un criterio di riconoscimento dichiarato.
2. **In uscita** — le **fatture emesse**, oggi del tutto assenti. **L'app prepara i dati, Fatture in Cloud emette e trasmette allo SDI**: non si costruisce un emettitore di fatture elettroniche. Casi: cliente che chiede fattura (evento, chef table, catering), cessioni orto → S.r.l.s. (oggi solo annotate), eventuali vendite dell'azienda agricola.
3. **I corrispettivi** del servizio al tavolo restano al **registratore telematico** (hardware, mandato futuro): non si simulano qui.
4. **Alimenta la Proiezione**: senza documenti attivi il lato ricavi resta a mano, come il food cost senza scarico.

**Criteri di accettazione**: una fattura d'acquisto arrivata due volte (API + email) produce un solo carico; una fattura emessa preparata dall'app e trasmessa da Fatture in Cloud; nessun segreto OAuth fuori dai Secrets; l'IVA e i ricavi risultano leggibili dalla Proiezione.

## Blocco 5 — La resa al posto dello scarto standard

**Decisione di Alessio, motivata**: lo scarto non è una proprietà dell'ingrediente ma della coppia **ingrediente × preparazione**. Le stesse cozze scartano pochissimo per un'impepata e moltissimo se se ne ricava il solo mollusco. Un numero unico sulla scheda dell'ingrediente non descrive nessuno dei due casi e ne precompila uno sbagliato.

1. **Il campo "scarto standard" sulla scheda dell'ingrediente sparisce.**
2. **La resa vive sulla riga di ricetta**, dove c'è il contesto — e si esprime in **lordo → netto** (*"1,5 kg di cozze danno 400 g sgusciate"*), non in percentuale: è il modo in cui ragiona un cuoco ed è autoesplicativo fra sei mesi. La percentuale la calcola il sistema.
3. **Migrazione prudente e obbligatoria**: prima di eliminare il campo, il valore attuale va **portato sulle righe di ricetta che oggi lo ereditano**. Altrimenti il food cost dei piatti già inseriti cambierebbe da solo, in silenzio, nella notte.
4. **Dove esisterà una produzione registrata, la resa misurata vince** su quella dichiarata; la dichiarata resta come base per la lista della spesa (quanto lordo comprare).

**Criteri di accettazione**: nessun piatto esistente cambia food cost per effetto della migrazione (confronto prima/dopo su tutte le ricette); la riga di ricetta accetta lordo→netto e mostra la percentuale calcolata; il campo sull'ingrediente non esiste più in nessuna schermata.

## Blocco 6 — La tracciabilità dei lotti va in HACCP, e guarda a valle

1. **La pagina si sposta sotto HACCP e si toglie dal Magazzino** — una sola collocazione, non due porte. Nessun dato si muove: è una vista sui lotti. **Rimando dall'indirizzo vecchio** al nuovo (stampo del redirect già usato per le comande).
2. **La voce va aggiunta nella schermata HACCP**, che oggi promette la rintracciabilità nella descrizione del modulo e non la mostra.
3. **La direzione a valle** — il salto vero, ora possibile perché il magazzino scende: dato un numero di lotto, **dove è finito** (quali giorni, quali piatti, quali conti). È ciò che serve in un controllo o in un richiamo del produttore; oggi la pagina mostra solo l'arrivo.
4. **Aggancio alle Produzioni** (quando ci saranno): un semilavorato eredita i lotti delle sue materie prime, altrimenti la catena si interrompe al primo ragù.

**Criteri di accettazione**: la pagina è raggiungibile solo da HACCP e il vecchio indirizzo rimanda; dato un lotto si vedono i consumi che ne sono usciti con data e destinazione; il Magazzino resta operativo con Scadenze per il lavoro quotidiano.

---

## Decisione aperta, da prendere con Alessio
**La regola d'emergenza sul push.** È successo due volte che dei commit siano stati pushati prima del riepilogo, entrambe per sbloccare Alessio dal vivo, entrambe dichiarate. O si scrive l'eccezione in `CLAUDE.md` (*in emergenza si pusha, il riepilogo arriva subito dopo e copre*), o si chiude. Non lasciarla implicita: un'eccezione non scritta si allarga da sola.

*Preparato dal validatore il 14/08/2026. Validazione per blocco: codice, produzione via connettore, e i criteri sopra.*
