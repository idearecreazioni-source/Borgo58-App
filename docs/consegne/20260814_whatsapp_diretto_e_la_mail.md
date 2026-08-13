# Consegna del 14/08/2026 (terza) — WhatsApp diretto e l'ordine per mail

**Commit della consegna: `ce4a62a`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `561626d` | il testo si può copiare, e il numero si scrive dove serve |
| `0dc703b` | WhatsApp si apre direttamente, senza passare dal loro sito |
| `2f0d6e3` | un fornitore che preferisce la mail lo dice una volta — `20260814000003` |
| `ce4a62a` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260814000003`. **89 migrazioni**. Nessuna
funzione online reinstallata.

---

## 1. Il primo ordine vero è partito

Prima di questa consegna, guardando la produzione col connettore:
**quattro ordini registrati da Alessio mentre provava** — tre annullati e
uno ancora in attesa (Mililli, 2 sacchetti di mandorle di Avola).

Coprono il **giro intero**, e sono le prove che le migrazioni non possono
dare:

- la bozza costruita con **le diciture del fornitore** («Mandorle di Avola
  sgusciate, sacchetto da 1 kg», «Melanzane nere lunghe sfuse»);
- la registrazione, con le righe che passano a «ordinata»;
- **WhatsApp aperto davvero**, con il messaggio precompilato e il numero
  giusto (screenshot: `+39 329 013 5414`);
- l'annullamento, con le righe che **tornano in lista** — provato tre
  volte.

Sono i **criteri di accettazione 2 e 4** del mandato «filiera della
spesa», dal vivo e non dentro una migrazione.

⚠️ Quei quattro ordini sono dati di collaudo: vanno cancellati con gli
altri, prima della prima fattura vera.

---

## 2. WhatsApp si apre direttamente

> *«Funziona sempre ma prima passa attraverso la schermata di WhatsApp
> Web prima di arrivare all'app.»*

`wa.me` passa dal sito di WhatsApp, che mostra una pagina intermedia con
«Apri l'app»: un clic in più **ogni volta**, su un gesto che si fa in
mezzo al servizio. `whatsapp://` parla direttamente col programma
installato.

⚠️ **Il prezzo del collegamento diretto, ed è il motivo per cui resta
anche l'altro**: se WhatsApp non fosse installato, `whatsapp://` **non fa
niente** — nessun errore, nessuna finestra. Senza una via d'uscita
visibile sembrerebbe che il gestionale si sia rotto. Accanto al pulsante
resta scritto *«se WhatsApp non si apre, aprilo dal browser»*, col
vecchio indirizzo.

**Nella stessa passata**, due difetti piccoli della stessa schermata: la
scritta «copia il testo e mandaglielo tu» **non dava un modo per
copiarlo** (un'istruzione che il sistema stesso non aiuta a eseguire), e
«questo fornitore non ha un numero» non diceva dove scriverlo.

---

## 3. L'ordine per mail — due decisioni di Alessio

> *«Nel caso in cui un fornitore preferisse una mail possiamo inserire una
> scelta?»*

Poste in termini di conseguenze, non di implementazione.

### La mail si apre nella sua posta, non parte dal gestionale

Stessa forma di WhatsApp: il gestionale scrive, lui preme invio. Così una
copia resta nella **sua posta inviata** e la risposta del fornitore arriva
in casella.

⚠️ **La macchina per inviare davvero esiste già** — Resend, in produzione
dall'11/08 per le conferme ai clienti. **Non è un limite tecnico: è una
scelta.** Un invio automatico da `prenotazioni@borgo58.it` sarebbe un
ordine che nessuno ha riletto, fuori dalla sua posta inviata, e la cui
mancata consegna si scoprirebbe solo quando manca la merce.

### Il canale si scrive una volta sulla scheda del fornitore

«Come preferisce essere contattato» ha sempre la stessa risposta per lo
stesso fornitore: chiederlo a ogni ordine è un clic che non aggiunge
informazione.

⚠️ **La terza strada, scartata e perché**: «se ha il numero usa WhatsApp,
se ha solo la mail usa la mail» non chiede niente da compilare — ma con
**entrambi** i recapiti sceglierebbe il gestionale, e sceglierebbe male
**senza dirlo**. Il campo resta **vuoto finché non lo compila**, e vuoto
vuol dire *«non l'ha detto»*: la schermata offre allora le strade che i
recapiti permettono, **senza preferirne una**. La verifica pretende
esattamente questo — che il canale non venga indovinato.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| senza canale scritto, la bozza torna **vuoto** e non un valore indovinato | **provato** |
| scritto una volta, torna sempre | **provato** |
| un canale inventato | **rifiutato** |
| l'indirizzo e l'oggetto («Ordine Borgo 58 — data») nella bozza | **provato** |
| il numero per WhatsApp non è cambiato (nessuna regressione) | **provato** |
| le righe della bozza non sono cambiate | **provato** |
| prove automatiche | **46 verdi** |
| lint, build | puliti |
| **produzione** | **89 migrazioni** |
| elenco anonimi · `security definer` senza portiere | **12** · **14**, invariati |
| residui della verifica in produzione | **zero** |
| **dal vivo**: bozza → registrazione → WhatsApp aperto → annullamento | **fatto da Alessio**, 4 ordini |

---

## 5. Cosa NON è verificato, e lo dico chiaro

- **La mail non è mai stata aperta da questa schermata**: nessun fornitore
  ha ancora `canale_ordine = 'email'` né un indirizzo in anagrafica. Il
  collegamento è costruito e provato nella forma, non nell'apertura.
- ⚠️ **Se Windows non ha un programma di posta predefinito, `mailto:` non
  fa niente** — stesso modo di fallire di `whatsapp://`. Per questo il
  pulsante «Copia il testo» resta sempre lì, ed è scritto accanto.
- **`whatsapp://` è stato provato solo su questo computer**, dove WhatsApp
  Desktop è installato. Il caso «non installato» non è stato visto.
- **Il canale «telefono» non fa niente di diverso**: registra l'ordine e
  basta, il messaggio serve solo a leggerlo mentre gli si parla. È
  dichiarato nel commento della colonna, non nella schermata.
- **La suite resta a 46**: nessuna prova automatica copre il canale lato
  applicazione. Le verifiche sono quelle dentro la migrazione.
- **I quattro ordini di prova sono in produzione** e vanno cancellati coi
  dati di collaudo; **`/prova-voce` è ancora lì**; il messaggio delle
  10:00 dello scadenziario non l'ha ancora visto partire nessuno.
