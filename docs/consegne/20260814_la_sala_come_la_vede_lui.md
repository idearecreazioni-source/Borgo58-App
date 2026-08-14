# Consegna del 14/08/2026 (decima) — la sala come la vede lui

**Commit della consegna: `e79d7b8`** (questo
riepilogo è il commit immediatamente sopra, sola documentazione). Working
tree pulito.

| Commit | Cosa |
|---|---|
| `dbc56fd` | la sala come la vede lui — migrazione `20260814000009` |
| `349fd66` | il verso che nessuno aveva scritto: la migrazione si è fermata da sola |
| `e79d7b8` | `CLAUDE.md`: due trappole nuove, e i numeri della sala |

**Applicata in produzione**: `20260814000009`. **95 migrazioni**. Nessuna
funzione online reinstallata.

Coda del blocco Sala, nata **dall'uso**: Alessio ha aperto la pianta
mezz'ora dopo la consegna e ha rimandato indietro uno screenshot con tre
correzioni disegnate sopra in rosso.

---

## 1. Le tre correzioni, e su due aveva ragione contro di me

1. **Lo Chef Table era al bancone in fondo a destra.** Non è lì: l'ha
   barrato e ha scritto dove sta davvero, in cima alla sala bassa verso il
   centro — che è anche dove la planimetria mette il banco di passaggio.
2. **I due rettangolari li vuole verticali.** ⚠️ Anche qui la planimetria
   gli dava ragione e **non l'ho seguita**: nel file di Sweet Home 3D i
   rettangolari sono girati di un quarto, e avevo seguito la descrizione
   a parole del mandato («180 × 90») invece del disegno che avevo sotto
   gli occhi.
3. **I divani erano troppo a sinistra** di circa due metri. Ha disegnato
   tre quadrati rossi dove vanno.

---

## 2. La rotazione allenta un vincolo del mandato, e va dichiarato

Il §4 del mandato elencava **«niente rotazione»** fra le cose da tenere
povere. Alessio ha chiesto *«la possibilità di ruotarli se possibile»*:
è una **sua** decisione, non una deriva di chi implementa.

Si allenta però il minimo indispensabile: **un quarto di giro, non un
angolo libero.** Un booleano che scambia larghezza e profondità, non un
campo di gradi — un tavolo in una sala si mette di traverso, non a 37°.

⚠️ **E la misura vera non cambia**: il tavolo resta `180 × 90` in tabella,
perché quella è la sua misura fisica. È il **disegno** a girarlo.
Scambiando i due numeri, fra sei mesi la scheda del tavolo avrebbe
raccontato un mobile che non esiste.

Il verso segue la stessa regola della posizione: si gira **per una
giornata**, e «questa diventa la sala di sempre» lo porta nella base.
Senza quella riga in `promuovi_disposizione`, promuovendo si sarebbe
portata la posizione e lasciata indietro la rotazione — e **nessuna delle
due cose sembrerebbe sbagliata guardandola**.

---

## 3. ⚠️ La migrazione si è fermata da sola in produzione, e ha fatto bene

**Il fatto**: la prima stesura aggiungeva `disposizioni_giornaliere.ruotato`
come `not null default false`. In produzione c'erano già **9 scostamenti**
— quelli che Alessio aveva appena creato trascinando i tavoli — e il
default gli ha scritto addosso un *«quel giorno il tavolo è diritto»* che
nessuno aveva mai detto. Quel valore inventato **vinceva sulla pianta
base**, che diceva il contrario: T1 e T2 girati nella base e diritti
nella giornata di oggi.

La verifica in fondo si è fermata dicendolo, **prima di registrare la
versione**.

⚠️ **Perché il progetto di prova non poteva accorgersene, ed è la parte
che conta**: lì `disposizioni_giornaliere` era **vuota**, quindi il
default non aveva nessuna riga su cui scrivere la propria risposta. È
**la stessa lezione del 12/08**, terza volta: *la prova non era falsa,
era su uno stato di partenza diverso da quello vero esattamente nel punto
rilevante.*

**La regola generale, scritta in `CLAUDE.md` §8**: quando una colonna
nuova ammette «non l'ho deciso», quel terzo stato dev'essere **`null`**,
non il valore più comodo. Un default è una risposta, e su righe già
esistenti è una risposta data da chi scrive la migrazione **al posto di
chi usa il gestionale**.

**Come è stato riparato**: la colonna sullo scostamento è nullabile, e
`null` vuol dire «vale il verso della base». La sanatoria toglie il
`false` inventato, e **il suo guardiano è una proprietà dello schema, non
una data**: finché la colonna è ancora `not null`, nessun client ha
potuto scrivere un «diritto» intenzionale, quindi tutti i `false` sono il
default. Dopo, il blocco non si esegue più — e una scelta vera non verrà
mai cancellata da una riesecuzione.

**Riprodotto prima di correggere**: sul progetto di prova ho seminato lo
stato della produzione (scostamenti con `ruotato = false`), riapplicato
sopra — **2 righe sanate, T1 e T2 tornati girati** — e poi due volte di
fila senza errori.

⚠️ **Ho corretto il file invece di scriverne uno nuovo**, e va detto
perché: `20260814000009` **non era registrata in produzione**, quindi
nessuno stato dipendeva dal testo vecchio. Una migrazione che non può mai
completare è peggio di un file corretto prima di essere accettato. Sul
progetto di prova, dove era registrata, la riesecuzione è idempotente e
porta allo stesso stato.

---

## 4. Il secondo difetto: era il controllo, non i dati

La verifica cercava sovrapposizioni su `pianta_del_giorno(current_date)`
e si è fermata su due sagome accostate.

⚠️ **Ma come sono messi i tavoli stasera lo decide Alessio**, e accostare
un tavolo a un divano è una cosa che in una sala si fa. Una migrazione
che si rifiuta di passare per una scelta legittima dell'utente è una
migrazione che prima o poi verrà aggirata.

I due controlli (perimetro e sovrapposizioni) ora guardano la **pianta
base**, che è ciò che questa migrazione governa. Lo stato che l'utente
costruisce ogni giorno non è affare suo.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata quattro volte**, di cui una **sopra il difetto riprodotto**: idempotente |
| il difetto del default, riprodotto e poi risolto | **2 scostamenti sanati**, T1 e T2 tornati girati |
| uno scostamento **senza verso** segue la base | **provato** |
| uno scostamento **con verso esplicito** vince sulla base | **provato** |
| girare per un giorno **non tocca** la pianta base | **provato** |
| promuovere porta nella base **anche il verso** | **provato** |
| il quarto di giro **non cambia la misura del mobile** | **provato**: disegno 90×180, tabella 180×90 |
| «il verso non l'ho deciso» resta dicibile (colonna nullabile) | **provato**, e resta come controllo permanente |
| permessi dopo il `drop` di `pianta_del_giorno` | **richiusi**: `anon` no, `authenticated` sì |
| lo staff non promuove | **rifiutato** |
| perimetro e sovrapposizioni **sulla pianta base** | **0 e 0** |
| geometria del disegno, misurata sul rendering vero | 13 sagome, **0 fuori dalla sala, 0 sovrapposte, 0 fuori zona** |
| lint, build, prove automatiche | **52 verdi**, puliti |
| **produzione** | **95 migrazioni** |
| dati veri dopo l'applicazione | **9 scostamenti**, tutti «senza verso»; **2 tavoli girati** nella base |
| dati di prova lasciati sul progetto di prova | **zero** (gli scostamenti seminati per la riproduzione sono stati cancellati) |

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **La pianta corretta non l'ha ancora vista nessuno.** Alessio aveva la
  schermata aperta da prima: il gestionale è una pagina sola che non si
  ricarica da sé, quindi finché non la ricarica vede il disegno vecchio.
  **Non è un difetto, ma è il motivo per cui ha scritto «non è
  cambiata».**
- **Il pulsante per girare un tavolo non è mai stato premuto** da una
  mano vera: è provato solo dentro la migrazione.
- ⚠️ **Divani e Chef Table restano non trascinabili**, per la regola del
  mandato (sono arredi fissi). Quindi **ogni ulteriore aggiustamento
  della loro posizione passa da una migrazione e da due push**. Se la
  posizione nuova ancora non gli torna, la scelta è sua: glielo sposto
  io, oppure si decide di poterli muovere anche dalla schermata — ma
  quello **cambia una regola del mandato** e va dichiarato al validatore.
- **Le posizioni nuove sono la mia lettura del suo disegno**, non misure
  che mi ha dato: i divani a 300/620/940 e lo Chef Table a 980,530 sono
  ricavati dai quadrati rossi e dalla scritta sullo screenshot.
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia**:
  resta il commit separato da autorizzare, come dichiarato nel riepilogo
  precedente.
