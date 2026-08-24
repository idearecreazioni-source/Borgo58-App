// LA RIGA CHE DICE «IL GIORNO QUI È LA SERATA» — 24/08/2026.
//
// 🔴 PERCHE' ESISTE. Questa frase era scritta a mano in due registri HACCP,
// e le due copie differivano già di una parola — «una lettura fatta dopo
// mezzanotte» contro «una pulizia fatta dopo mezzanotte». Una sola parola,
// ma da lì in avanti ogni correzione a una lasciava l'altra indietro: è la
// forma in cui una nota ripetuta diventa due note diverse senza che nessun
// errore lo segnali.
//
// ⚠️ NON HA `print:hidden`, ED È IL PUNTO. Il destinatario di questi fogli
// non è chi sta davanti allo schermo: è chi viene a controllare, e deve
// sapere che il giorno è la serata di servizio — altrimenti una
// registrazione dell'una di notte gli sembrerà mancante dal giorno in cui
// la cerca.
//
// ⚠️ La seconda frase è un LIMITE, non una spiegazione, e per questo resta
// a schermo invece di finire dietro un segno: chi legge il foglio deve
// sapere che il formato non è ancora stato validato da una biologa.
export default function GiornataDiServizio({ cosa }) {
  return (
    <span className="block text-b58-charcoal-soft/70">
      La giornata è quella di servizio: {cosa} fatta dopo mezzanotte resta nella serata
      che si stava chiudendo. Formato provvisorio, da rivedere con la biologa.
    </span>
  );
}
