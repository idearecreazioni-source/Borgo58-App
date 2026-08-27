# Arretrato: le cinque migrazioni che nessun riepilogo nominava

**27/08/2026** · riepilogo **arretrato**, scritto da una sessione successiva.

---

## Perché questo file esiste

`npm run migra` si è **rifiutato di guardare la produzione**:

```
FERMO: queste migrazioni sono gia' in produzione e nessun riepilogo le nomina.
  · 20260827000013
  · 20260827000014
  · 20260827000015
  · 20260827000016
  · 20260827000017
```

✅ **La rete del 16/08 ha funzionato esattamente come doveva.** I riepiloghi
esistenti del 27/08 nominano le versioni fino alla `20260827000012`
([la via d'uscita a mano](20260827_la_via_d_uscita_a_mano.md)); le cinque
successive sono state **applicate in produzione e non documentate**, e finché
l'arretrato è aperto non si applica altro.

⚠️ **QUESTO NON È IL RIEPILOGO DI UNA CONSEGNA: È LA CHIUSURA DI UN DEBITO.**
Il lavoro l'ha fatto una sessione precedente, e chi scrive qui **non ha
misurato niente al momento dell'applicazione**. Quello che segue è ricavato
**leggendo i file** e il registro delle migrazioni in produzione — non dai
numeri veri di quando sono entrate, che nessuno ha scritto e che non si
possono ricostruire.

---

## Cosa contengono, in ordine

| versione | cosa fa |
|---|---|
| **20260827000013** — `il_percorso_arriva_nell_elenco` | Il collegamento «dove si va» arriva **dentro i due elenchi** delle azioni dettate in attesa, invece di essere ricalcolato dalla schermata. La ragione scritta nel file: una mappa da undici voci nel browser sarebbe **una seconda definizione**, e il giorno che nasce un tipo nuovo il database lo saprebbe e il browser no. Non si chiede riga per riga per non fare dieci giri di rete per dieci pulsanti. |
| **20260827000014** — `le_due_porte_dell_uscita_a_mano` | 🔴 **Trovate dalla rete `tests/app/permessi.test.js`, non rileggendo**: 23 attese, 25 trovate. Le due in più erano nate un'ora prima con la `…012`. Due cure diverse: `azione_campi` **si chiude** (non la chiama nessuno dal browser), l'altra riceve un portiere. |
| **20260827000015** — `un_valore_fuori_vocabolario_resta_fuori` | 🔴 **Trovato aprendo la schermata.** Un `<select>` che riceve un valore fuori dalle sue opzioni **mostra la prima**: a schermo `fisco_scadenze`, nel database `altro`, e **nessuno dei due l'ha scelto una persona**. I campi precompilati passano da `valore_del_vocabolario()`, che interroga `vocabolari_chiusi()` — enum **e** vincoli `check`. |
| **20260827000016** — `la_verifica_che_non_vedeva_il_filtro_troppo_stretto` | 🔴 **Trovato dalla SECONDA rottura, non dalla prima.** Il filtro può sbagliare in due versi, e la verifica prendeva solo uno: messo un filtro che scarta tutto, restava **verde**. La causa misurata: `null <> 'primo'` vale **NULL** e un `if` su NULL non scatta, mentre `null is distinct from 'primo'` vale **true**. Ricomparsa della trappola del 26/08 **nello stesso giorno in cui era stata riletta**. |
| **20260827000017** — `la_verifica_che_prendeva_in_prestito_un_ingrediente` | 🔴 **La `…006` si è fermata in produzione**, e il difetto era nella verifica: prendeva in prestito «il primo ingrediente del magazzino» per costruire un esempio. In produzione ce ne sono **zero**. Il codice era già in produzione e funzionante (constatato dal catalogo): a mancare era la riga in `applied_migrations`, che questa migrazione scrive. Da qui la regola **«un esempio si costruisce, non si prende in prestito»**. |

---

## Cosa abbiamo rovesciato

**Niente.** Questo file non prende nessuna decisione e non tocca nessuna riga
di codice: è documentazione arretrata.

---

## Cosa NON è verificato, e va detto

- 🔴 **I numeri veri dell'applicazione non esistono.** La rete del 16/08
  controlla *ciò che è già applicato* proprio perché il riepilogo deve
  contenere i numeri misurati **dopo**. Qui quei numeri non sono stati
  scritti da nessuno al momento giusto, e **non si possono ricostruire**:
  ricavarli oggi dal database darebbe lo stato di adesso, non quello di
  allora, e sarebbe un numero plausibile al posto di una misura.
- **Nessuna di queste cinque è stata riletta riga per riga** da chi scrive
  qui: le descrizioni vengono dalle intestazioni dei file, che in questo
  progetto sono la parte più curata — ma restano **quello che il file dice di
  sé**, non una verifica indipendente.
- **Nessuna schermata è stata riaperta** per controllare che gli effetti
  descritti si vedano.

---

## Stato misurato adesso (vero)

- migrazioni nel repository: **297**
- già applicate in produzione: **289**, l'ultima è `20260827000017`
- in attesa del push e dell'applicazione: **8** (`…018` → `…025`), tutte del
  blocco sulla separazione prodotto / ingrediente — vedi
  [prodotto e ingrediente](20260827_prodotto_e_ingrediente.md)

⚠️ **Con questo file l'arretrato è chiuso** e `npm run migra` torna a guardare
la produzione. La regola resta intera: *il riepilogo si scrive nella stessa
sessione, e non si accumula.*
