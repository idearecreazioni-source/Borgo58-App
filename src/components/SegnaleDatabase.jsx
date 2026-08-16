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
// ⚠️ E POI ANCHE LA FORMA, non solo il posto — seconda correzione di
// Alessio, dopo il secondo collaudo. La prima versione della striscia sul
// locale vero era **sottile e grigio chiaro**, per non disturbare. Ma un
// grigio sottile accanto a un rosso pieno non sono due stati: sono due
// segni diversi, e il più discreto è proprio quello che avvisa del caso
// più pericoloso.
//
// *Non serve accorgersi della striscia: serve accorgersi quando CAMBIA —
// e questo funziona solo se le due sono confrontabili a colpo d'occhio.*
// Quindi stessa altezza, stesso peso, stesso testo su due righe. Cambiano
// il colore e le parole, nient'altro.
//
// Sta fuori dal Layout apposta: vale anche sulle Comande e sulla pagina
// pubblica, che il Layout non lo usano. `print:hidden` ovunque: su un
// preconto o su un registro HACCP non c'entra niente.
// Le tre parole di ogni stato: il resto — posizione, altezza, peso — è
// identico per costruzione, perché è scritto una volta sola più sotto.
const STATI = {
  produzione: {
    fondo: "bg-b58-charcoal text-b58-parchment",
    titolo: "DATI VERI",
    // ⚠️ Simmetrica a quella rossa, e il verso è opposto apposta: la rossa
    // dice cosa NON succede, la grigia dice cosa succede.
    spiegazione: "quello che scrivi qui conta davvero.",
  },
  prova: {
    fondo: "bg-b58-terracotta text-b58-parchment",
    titolo: "DATABASE DI PROVA",
    spiegazione: "quello che scrivi qui non è vero, e quello che leggi nemmeno.",
  },
  sconosciuto: {
    fondo: "bg-b58-terracotta text-b58-parchment",
    titolo: "DATABASE SCONOSCIUTO",
    spiegazione: "nessuno ha dichiarato questo database: non fidarti di quello che leggi.",
  },
};

export default function SegnaleDatabase() {
  const ambiente = ambienteCorrente();
  const stato = STATI[ambiente.genere] ?? STATI.sconosciuto;

  // ⚠️ Una sola striscia, scritta una volta: posizione, altezza, peso e
  // testo vengono tutti da qui, e fra uno stato e l'altro cambiano solo il
  // colore e le parole. Non è eleganza — è la proprietà che Alessio ha
  // chiesto di rendere vera nel codice e non nell'intenzione: due stati
  // dello stesso segno **devono avere la stessa forma**, altrimenti sono
  // due segni diversi e si imparano peggio.
  return (
    <div
      title={`Progetto Supabase ${ambiente.riferimento || "(nessuno)"}`}
      className={`print:hidden sticky top-0 z-50 w-full text-center px-4 py-2 text-sm ${stato.fondo}`}
    >
      <strong>{stato.titolo}</strong> — {stato.spiegazione}
      {ambiente.riferimento && <span className="opacity-75"> ({ambiente.riferimento})</span>}
    </div>
  );
}
