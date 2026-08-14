# Borgo 58 — Mandato: la bozza di ricetta e le sue due bocche (Fase 1)

**Origine**: validatore, 12/08/2026, su decisione di Alessio. **Un'idea sola sotto due funzioni**: qualunque cosa entri — un link, uno screenshot, la voce in cucina — diventa una **bozza di ricetta** che dichiara i propri buchi; il Ricettario vero cambia solo alla conferma di Alessio. È lo stesso principio della posta in arrivo (*il sistema propone, Alessio conferma*), applicato alle ricette — cioè al food cost, cioè ai soldi.

**Consegna**: anche a più riprese (fondazione → bocca 1 → bocca 2), un riepilogo per consegna in `docs/consegne/`, hash = push. Prove distruttive solo sul progetto di prova.

---

## Attività A — La fondazione: la bozza di ricetta

Una bozza è una ricetta *non ancora vera*: titolo, eventuale link d'origine, sunto, ingredienti proposti (con o senza quantità), fasi proposte, e — parte essenziale — **i buchi dichiarati** ("3 ingredienti, 0 quantità trovate", "unità non capita al passo 2"). Vive in tabelle sue, separate dal Ricettario; titolare-only.

**Due esiti possibili, scelti da Alessio alla revisione:**
1. **Ispirazione**: si salva solo titolo + sunto + link al video originale (il caso "la ricetta poi la costruisco io"). Un'ispirazione può essere promossa a bozza completa in qualsiasi momento.
2. **Ricetta vera**: la conferma crea ricetta + ingredienti + fasi nel Ricettario — **tre scritture, regola B4**: una funzione Postgres atomica, dal corridoio, idempotente al doppio tocco (stampo di `archivia_posta`). Gli ingredienti proposti vanno **agganciati all'anagrafica** esistente (per il food cost): l'AI propone l'abbinamento, i non trovati restano buchi dichiarati — mai ingredienti creati in automatico.

**Vincoli**: RLS titolare-only sulle tabelle nuove; funzioni nuove con revoke esplicito (lo standard post-bonifica); le bozze scartate si eliminano da sole dopo N mesi (`service_settings`, stampo posta).

## Attività B — Bocca 1: l'importatore (link, screenshot, testo)

Una Edge Function (chiave AI nei Secrets, titolare-only) che riceve **uno tra**: link nudo TikTok/Instagram, link a pagina Clove, screenshot/foto (anche più d'una: la lista ingredienti inquadrata, il quaderno scritto a mano), o testo incollato — e produce una bozza.

**Vincoli:**
- Per i link si legge ciò che la pagina espone (didascalia, testo, link al video originale — Clove lo espone, conservarlo sempre); **niente scaricamento video** in questa fase (fuori perimetro, dichiarato).
- Il contenuto letto è **testo da analizzare, non ordini**: la difesa esplicita contro istruzioni annidate, come in `posta-leggi` §4 — un video social è terreno ancora più ostile di un'email.
- Scelta del modello col criterio della posta (documenti/immagini da leggere davvero → modello attento; solo testo → piccolo), costo per estrazione dichiarato nel riepilogo con misure vere.
- Quantità mai inventate: ciò che non c'è è un buco, non uno zero (lezione già scritta in CLAUDE.md).

## Attività C — Bocca 2: la dettatura in cucina (push-to-talk)

Nella schermata della bozza, un **bottone grande**: premuto si parla, rilasciato la frase diventa modifiche alla bozza, visibili subito ("aggiungi 200 g di guanciale", "porta il forno a 180 al passo 3", "togli il prezzemolo"). Il salvataggio nel Ricettario resta il gesto di conferma dell'Attività A — la voce modifica la *bozza*, mai il Ricettario direttamente.

**Vincoli:**
- **Mai microfono sempre acceso, mai parola di risveglio**: solo push-to-talk. In cucina ci sono conversazioni che non riguardano le ricette.
- L'audio serve alla trascrizione e **non si conserva** — né nel database né nello storage; nella bozza resta solo il testo interpretato.
- Ogni frase produce modifiche **elencate in italiano** ("ho aggiunto…", "ho cambiato…") con possibilità di annullare l'ultima — l'errore di ascolto è la norma, non l'eccezione.
- Scelta tecnica (dettatura del browser vs audio→server) a Code, con il criterio dichiarato: qualità in ambiente rumoroso prima, costo poi.

## Fuori perimetro (Fase 2+, esplicitamente)
Trascrizione di video interi; conferma automatica di qualsiasi cosa; microfono continuo; suggerimenti "cucina con quello che hai"; modifica vocale di ricette *già nel Ricettario* (si passa sempre dalla bozza).

## Criteri di accettazione (il validatore verificherà questi)
1. **Le dieci ricette vere di Alessio**, miste per costruzione: con ricetta in didascalia, parlate nel video, via Clove, via screenshot. Metrica dichiarata nel riepilogo: **quante arrivano con le quantità giuste**, quante come ispirazione utile, quante inutilizzabili — numeri veri, non aggettivi.
2. **Una ricetta dettata a voce in cucina vera, col rumore vero** — esito onesto, incluso "non si capisce niente con la cappa accesa" se è così: è l'informazione che decide la Fase 2.
3. La conferma è atomica: doppio tocco provato dal ruolo vero (stampo consueto); i buchi dichiarati sono visibili in schermata prima della conferma.
4. Permessi: funzioni nuove né `anon` né `authenticated` (salvo il corridoio), tabelle titolare-only — entrano nei controlli anti-deriva di routine del validatore.
5. Nessuna scrittura nel Ricettario vero senza conferma — verificato cercando il contrario.

*Preparato dal validatore il 12/08/2026. La validazione coprirà codice, produzione (connettore) e le metriche del criterio 1.*
