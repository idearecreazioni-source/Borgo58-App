import { ambienteCorrente } from "../lib/ambiente";

// A quale database sto parlando — scritto in schermata, non solo in un
// file di configurazione.
//
// ⚠️ Il motivo per cui esiste, e perché si dichiara in TUTTE E DUE le
// direzioni. Da quando il gestionale si può puntare al progetto di prova
// (`npm run dev:prova`), le due schermate sono identiche: se il segno
// comparisse solo sulla prova, proteggerebbe soltanto chi si ricorda che
// quel segno esiste — e il caso pericoloso è l'altro, cioè **stare sul
// locale vero credendo di stare sulla prova** e riempirlo di dati finti.
// Un dato finto indistinguibile da uno vero toglie fiducia a tutto quello
// che il gestionale dice (§5 punto 8).
//
// Due forme diverse perché i due casi non sono simmetrici:
//  - sulla PROVA una fascia larga in cima, che occupa spazio e non si può
//    non vedere: lì si sta apposta, e per poco tempo;
//  - sul VERO una targhetta piccola in un angolo, ferma sopra tutto: è lo
//    stato normale di ogni giorno, e una fascia larga per sempre si
//    smetterebbe di vedere in una settimana — cioè non varrebbe niente
//    proprio il giorno in cui serve.
//
// Sta fuori dal Layout apposta: vale anche sulle Comande e sulla pagina
// pubblica, che il Layout non lo usano. `print:hidden` ovunque: su un
// preconto o su un registro HACCP non c'entra niente.
export default function SegnaleDatabase() {
  const ambiente = ambienteCorrente();

  if (ambiente.produzione) {
    return (
      <div
        title={`Progetto Supabase ${ambiente.riferimento}`}
        className="print:hidden fixed bottom-2 left-2 z-50 rounded-full bg-b58-charcoal/70 text-b58-parchment text-[10px] leading-none px-2.5 py-1 pointer-events-none select-none"
      >
        dati veri
      </div>
    );
  }

  return (
    <div className="print:hidden sticky top-0 z-50 bg-b58-terracotta text-b58-parchment px-4 py-2 text-center text-sm">
      <strong>
        {ambiente.genere === "prova" ? "DATABASE DI PROVA" : "DATABASE SCONOSCIUTO"}
      </strong>{" "}
      — quello che scrivi qui non è vero, e quello che leggi nemmeno.
      {ambiente.riferimento && (
        <span className="opacity-75"> ({ambiente.riferimento})</span>
      )}
    </div>
  );
}
