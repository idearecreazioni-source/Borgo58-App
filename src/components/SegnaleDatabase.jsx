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
// ⚠️ UN SOLO SEGNO, DUE STATI — e non era la prima versione. Il 16/08 il
// segno sul locale vero era una targhetta piccola in basso a sinistra, e
// al collaudo Alessio l'ha vista **solo perché la stava cercando**: il
// criterio era «notata senza cercarla», e in basso a sinistra non guarda
// mai nessuno mentre lavora.
//
// La correzione è sua, e la ragione vale più della modifica: *due segni in
// due posti diversi si imparano peggio di due stati dello stesso segno.*
// Se l'occhio deve controllare **un solo punto** per sapere dove sta, il
// controllo diventa automatico in due giorni. Quindi stessa posizione
// sempre — in cima, ferma mentre si scorre — e a cambiare sono **il
// colore e il testo**, mai il posto.
//
// Il tono resta diverso apposta: rosso pieno sulla prova (ci si sta
// apposta, e per poco), grigio sottile sul vero (è ogni giorno, e un segno
// invadente per sempre viene ignorato prima e nascosto poi).
//
// Sta fuori dal Layout apposta: vale anche sulle Comande e sulla pagina
// pubblica, che il Layout non lo usano. `print:hidden` ovunque: su un
// preconto o su un registro HACCP non c'entra niente.
export default function SegnaleDatabase() {
  const ambiente = ambienteCorrente();

  // La posizione è scritta una volta sola: se cambia, cambia per tutti e
  // due gli stati — che è esattamente la proprietà da non perdere.
  const posizione = "print:hidden sticky top-0 z-50 w-full text-center";

  if (ambiente.produzione) {
    return (
      <div
        title={`Progetto Supabase ${ambiente.riferimento}`}
        className={`${posizione} bg-b58-charcoal/10 text-b58-charcoal-soft border-b border-b58-charcoal/10 px-4 py-1 text-[11px] leading-tight tracking-wide`}
      >
        dati veri
      </div>
    );
  }

  return (
    <div className={`${posizione} bg-b58-terracotta text-b58-parchment px-4 py-2 text-sm`}>
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
