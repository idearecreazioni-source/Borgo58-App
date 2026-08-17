# Decisioni rovesciate

L'elenco di ogni decisione **motivata** che è stata poi cambiata, in un posto
solo e in una forma sola.

⚠️ **Perché esiste.** Un rovesciamento non dichiarato è la forma di deriva che
**nessun controllo automatico può prendere**: il codice nuovo è coerente con
sé stesso, e l'unica traccia è che qualcuno aveva deciso diversamente e aveva
una ragione. Se i rovesciamenti restano dentro il testo dei riepiloghi, la
domanda che conta fra sei mesi — *«questa decisione l'abbiamo già rovesciata
prima?»* — richiede di aprirli tutti.

**Due posti, due domande diverse.** Il **racconto** sta nel riepilogo del giro,
in una sezione fissa; il **conteggio** sta qui, una riga per rovesciamento.

## La forma, sempre la stessa — quattro righe

1. **cosa era stato deciso, e quando**
2. **la ragione di allora**
3. **cosa si decide adesso**
4. **perché la ragione di allora non vale più** — *oppure*: **vale ancora, e
   questo è il prezzo che accettiamo**

⚠️ **La quarta riga è quella che serve davvero**: distingue «la ragione era
sbagliata» da «la ragione era giusta e abbiamo scelto lo stesso», che sono due
cose diverse quando qualcuno rilegge.

⚠️ **E la sezione nel riepilogo c'è anche quando è vuota** — «nessun
rovesciamento in questo giro». È il precedente del riepilogo del Magazzino: un
riquadro che compare solo nei guai fa dubitare, quando manca, di non averlo
visto. *L'assenza non è un'informazione; «niente da segnalare» sì.*

---

## L'elenco

| # | data | decisione rovesciata | dove è raccontato |
|---|---|---|---|
| 1 | 14/08/2026 | *Una richiesta in attesa occupa il posto* (10/08) | [la pianta viva](consegne/20260814_la_pianta_viva.md) |
| 2 | 18/08/2026 | *Nel sistema non esiste una capacità per tavolo* (14/08) | mandato sala, giro B — riepilogo da scrivere |

---

## 1 · 14/08/2026 — «una richiesta in attesa occupa il posto»

**Cosa era stato deciso, e quando.** Il 10/08: una richiesta di prenotazione
ancora da confermare **tiene occupati i posti**, così due clienti non possono
prenotare lo stesso tavolo mentre Alessio decide.

**La ragione di allora.** Esisteva un calcolo dei posti liberi, e senza quella
regola il conteggio avrebbe mostrato come disponibili dei posti che qualcuno
stava già chiedendo.

**Cosa si decide adesso.** Una richiesta in attesa **non tiene niente**. Il
tavolo lo dà Alessio dalla pianta.

**Perché la ragione di allora non vale più.** Perché **il calcolo dei posti
non esiste più**: il 14/08 è stato rimosso — non spento — insieme a
`dining_tables.seats`, `posti_liberi()`, la durata del tavolo e il tetto dei
coperti. La regola aveva senso *solo* finché esisteva il conteggio che la
rendeva necessaria; tolto quello, difendeva un numero che nessuno calcolava
più.

*Dichiarato a suo tempo nel briefing del mandato Sala: non è un arretrato
nascosto, è riportato qui nella forma nuova.*

---

## 2 · 18/08/2026 — «nel sistema non esiste una capacità per tavolo»

**Cosa era stato deciso, e quando.** Il 14/08: nessun numero di coperti su un
tavolo. `dining_tables_sagoma_check` **rifiuta** un `tavolo` con
`posti_fissi`; i posti li hanno solo divani e Chef Table, che sono arredi
fissi e non entrano in nessun calcolo.

**La ragione di allora.** *«La capienza varia con la disposizione»*: con i
tavoli veri, contare un secchio di posti e sottrarre le persone prenotate è
sbagliato **per costruzione** — due persone a un tavolo da sei lasciano quattro
posti che non esistono.

**Cosa si decide adesso.** Sul tavolo si legge quanti ne tiene: 90×90 = 4,
180×90 = 6. Accostandone due o più, il numero si aggiorna con la regola *somma
meno due per ogni giunzione*.

**Perché la ragione di allora non vale più — anzi: vale ancora, ed è per
questo che la forma nuova è diversa.** La ragione del 14/08 **non era che i
posti non esistono**: era che *un totale di sala fisso non descrive la sala*.
E infatti il giro B **non ripristina il secchio unico**: i posti tornano a
esistere **dentro il tavolo**, il totale della serata si ricalcola **sulla
disposizione di quel giorno**, e un accostamento **abbassa** il totale invece
di lasciarlo fermo.

> **La decisione del 14/08 non viene smentita: viene resa più precisa.**
> Quello che cade è «non esiste capacità per tavolo»; quello che resta — e
> diventa più forte — è «non esiste una capienza della sala indipendente da
> come è messa».

⚠️ **E resta un prezzo, accettato**: il vincolo che vietava i coperti sui
tavoli era anche una difesa contro il ritorno del secchio unico. Togliendolo,
quella difesa la fa il **disegno** e non più il database. La prova che deve
tenerla ferma è dichiarata nel mandato: *stessa sera, stesse prenotazioni, due
disposizioni diverse, due totali diversi.*
