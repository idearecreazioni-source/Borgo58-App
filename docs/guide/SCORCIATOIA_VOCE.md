# Parlare al gestionale dall'orologio

Come fare in modo che, premendo un pulsante sull'Apple Watch, si possa
dire una cosa al gestionale senza tirare fuori il telefono.

⚠️ **Questa guida è per Alessio, e si segue sul telefono.** Gli stessi
passi sono anche dentro il gestionale, in *Parla e basta → Parlare senza
aprire il gestionale*, così non serve avere due schermi aperti.

🔴 **Quello che ancora nessuno ha provato**, e va detto prima: che la
registrazione parta davvero **dal polso**, e che regga **a schermo
spento**. Il gestionale è pronto a ricevere — quello si è provato — ma la
parte dell'orologio la può verificare solo lui, con l'orologio al polso.
Se non funzionasse, la stessa Scorciatoia funziona comunque dal telefono.

---

## Prima: prendi la chiave

1. Apri il gestionale e vai su **Parla e basta**.
2. In fondo, tocca **«Parlare senza aprire il gestionale»**.
3. Scrivi a che dispositivo la dai — per esempio *iPhone di Alessio* — e
   tocca **«Crea una chiave»**.
4. Compare una riga di lettere e numeri: **copiala adesso.** Non si vedrà
   mai più. Se la perdi non è un guaio: se ne fa un'altra e si toglie la
   vecchia.

⚠️ **La chiave vale come le chiavi del locale**: chi ce l'ha può far fare
al gestionale le stesse cose che gli fai fare tu con la voce. Se perdi il
telefono, entra qui e tocca **Togli** accanto a quella chiave: da quel
momento non apre più niente.

---

## Poi: costruisci la Scorciatoia

Sull'iPhone, apri l'app **Comandi rapidi** (quella con l'icona di due
quadratini colorati).

1. In alto a destra tocca **+** per fare un comando nuovo.

2. Tocca **«Aggiungi azione»** e cerca **«Detta testo»**. Toccala.
   · Sotto compare *Interrompi ascolto: Alla pausa*. Toccalo e mettilo su
     **«Al tocco»**: così puoi fare una pausa mentre cerchi un barattolo
     senza che si chiuda da solo.

3. Tocca ancora **«Aggiungi azione»** e cerca **«Ottieni contenuto di
   URL»**. Toccala.

4. Nel campo dell'indirizzo incolla questo:

   ```
   https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1/ascolta-voce
   ```

5. Tocca la freccina **▸** accanto a «Ottieni contenuto di URL» per
   aprire le sue impostazioni, e metti:
   · **Metodo**: `POST`
   · **Corpo richiesta**: `JSON`

6. Sotto «Corpo richiesta» tocca **«Aggiungi nuovo campo» → Testo**, e
   fai due campi:
   · primo campo: chiave `testo`, valore **«Testo dettato»** (lo scegli
     dalla barra sopra la tastiera: è il risultato del passo 2, non lo
     scrivi a mano);
   · secondo campo: chiave `chiave`, valore **la chiave che hai copiato
     prima**.

7. In alto dai un nome al comando: **«Borgo 58»**. È il nome che dirai a
   Siri, quindi tienilo corto.

8. Tocca **Fine**.

---

## Come si usa

- **Dal telefono**: apri Comandi rapidi e tocca «Borgo 58». Oppure dì
  «Ehi Siri, Borgo 58».
- **Dall'orologio**: sull'Apple Watch apri l'app **Comandi rapidi** e
  tocca «Borgo 58». Se vuoi averlo ancora più a portata, mettilo come
  **complicazione** sul quadrante: si tiene premuto il quadrante,
  **Modifica**, si sceglie una posizione e si mette *Comandi rapidi →
  Borgo 58*.

Poi parli, e quando hai finito tocchi per fermare. Il gestionale scrive
da sé le cose di cui è sicuro; il resto lo trovi in **Parla e basta**, e
sulla schermata iniziale compare quanti sono.

---

## Se non funziona

**«Questa chiave non vale»**
La chiave è stata copiata male, oppure è stata tolta. Falla di nuovo dal
gestionale e ricopiala nel passo 6.

**Non succede niente e non compare nessun errore**
Nel passo 5 mancano il metodo `POST` o il corpo `JSON`. Riaprili e
controllali.

**Ha capito una cosa per un'altra**
È normale che ogni tanto non sia sicuro: quello che non sa lo mette da
parte e te lo chiede in *Parla e basta*, invece di scriverlo lo stesso.

**«Sono già arrivate 60 dettature nell'ultima ora»**
Il gestionale si è fermato da sé. O il comando è partito in circolo da
solo, o quella chiave ce l'ha qualcun altro. Toglila e falla nuova.

---

## Perché è fatta così

⚠️ **La voce non esce mai dal telefono.** L'azione «Detta testo»
trascrive lì dentro, sull'apparecchio: quello che parte verso il
gestionale è già testo scritto. Non c'è nessuna registrazione da
conservare, e non c'è niente da cancellare dopo.

⚠️ **La chiave c'è dal primo giorno**, e non è una precauzione teorica:
quell'indirizzo è raggiungibile da chiunque lo conosca. Aggiungerla dopo
avrebbe voluto dire rifare la Scorciatoia sul telefono **e** sull'orologio.
