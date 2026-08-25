import Logo from "../../components/Logo";

// Informativa privacy — pagina pubblica, raggiungibile dal form /prenota.
//
// ⚠️ IL TESTO QUI SOTTO È UN SEGNAPOSTO. Va sostituito da quello che
// Alessio farà verificare da chi lo segue per gli adempimenti: un'informativa
// sbagliata è peggio di un'informativa assente, perché dichiara al cliente
// cose che il locale poi non fa.
//
// Quello che il sistema fa DAVVERO oggi è descritto — e tenuto allineato
// allo schema del database — in docs/DATI_PERSONALI.md. È da lì che si
// scrive il testo vero, non a memoria.

const SEZIONI = [
  {
    titolo: "Chi tratta i tuoi dati",
    corpo:
      "Borgo 58 — Osteria Contemporanea S.r.l.s., Piazza Armerina (EN). " +
      "[DA SOSTITUIRE: indirizzo completo, partita IVA e indirizzo email di contatto.]",
  },
  {
    titolo: "Quali dati raccogliamo",
    corpo:
      "Solo quelli che scrivi nel modulo di prenotazione: nome, telefono, " +
      "eventuale email, numero di persone, data e ora richieste e le note che " +
      "aggiungi tu (per esempio allergie o un'occasione speciale).",
  },
  {
    titolo: "Perché",
    corpo:
      "Per rispondere alla tua richiesta di prenotazione e per accoglierti in " +
      "sala. Nient'altro: non inviamo comunicazioni pubblicitarie e non cediamo " +
      "i dati a nessuno.",
  },
  {
    titolo: "Per quanto tempo",
    corpo:
      "Se la richiesta non viene accolta o viene annullata, i dati vengono " +
      "cancellati automaticamente dopo sei mesi, insieme al contatto se non " +
      "resta nessun'altra prenotazione collegata. Le prenotazioni effettivamente " +
      "confermate restano nei registri del locale. " +
      "[DA SOSTITUIRE: da confermare con il consulente anche per le confermate.]",
  },
  {
    titolo: "I tuoi diritti",
    corpo:
      "Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i " +
      "tuoi dati scrivendo a [DA SOSTITUIRE: indirizzo email dedicato]. " +
      "Rispondiamo entro un mese.",
  },
];

export default function InformativaPrivacy() {
  return (
    <div className="min-h-screen bg-b58-parchment px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <h1 className="text-2xl font-serif text-b58-charcoal text-center mb-2">
          Informativa privacy
        </h1>
        <p className="text-center testo-sala text-b58-charcoal-soft/80 mb-8">
          Come trattiamo i dati di chi ci chiede un tavolo.
        </p>

        <div className="rounded-lg border border-b58-terracotta/40 bg-b58-terracotta/10 px-4 py-3 mb-8">
          <p className="testo-sala text-b58-charcoal">
            <strong>Testo provvisorio — DA SOSTITUIRE.</strong> Questa versione è in
            verifica dal consulente: descrive quello che il sistema fa davvero, ma
            non è ancora il testo definitivo.
          </p>
        </div>

        <div className="space-y-6">
          {SEZIONI.map((s) => (
            <section key={s.titolo}>
              <h2 className="font-medium text-b58-charcoal mb-1">{s.titolo}</h2>
              <p className="testo-sala-grande text-b58-charcoal-soft leading-relaxed">{s.corpo}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="/prenota"
            className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-terracotta hover:text-b58-terracotta-dark underline"
          >
            ← Torna alla richiesta di prenotazione
          </a>
        </div>
      </div>
    </div>
  );
}
