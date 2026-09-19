// =====================================================================
// LE PROVE AUTOMATICHE NON SUONANO IL TELEFONO — 19/09/2026
// =====================================================================
// Il perche' sta nella migrazione 20260919000001. Qui c'e' solo la regola,
// in un file a se' per poterla provare senza mandare niente.
//
// ⚠️ SI TACCIONO ALLARMI E PRENOTAZIONI, MAI I PROMEMORIA. Un promemoria lo
//    crea una persona: rispondere «muto» lo farebbe risultare mancato, e il
//    giro dei promemoria lo ritenterebbe fino a dichiararlo perso.
//
// ⚠️ FUORI DA PROVA NON SI CHIEDE NEMMENO: in produzione la funzione si
//    comporta esattamente come prima, senza una chiamata in piu'.
//
// ⚠️ SE LA DOMANDA FALLISCE, SI MANDA — cioe' si torna a com'era prima di
//    questa correzione. Il silenzio e' una comodita' per le prove; un
//    allarme perso perche' la domanda e' andata storta sarebbe peggio.

import { siamoSuProva } from "./ambiente.ts";

export type Payload = { type?: string; record?: { source?: string } };

/** Questo messaggio e' fra quelli che un silenzio di prova puo' tacere? */
export function silenziabile(payload: Payload): boolean {
  if (payload?.type === "task_reminder") return false;
  if (payload?.type === "allarme") return true;
  return payload?.record?.source === "form_pubblico";
}

/**
 * Tacere o mandare? `zittite` si chiama solo quando serve (su Prova, per un
 * messaggio silenziabile), e un suo errore vale «manda».
 */
export async function deveTacere(opz: {
  payload: Payload;
  supabaseUrl: string | undefined | null;
  zittite: () => Promise<boolean>;
}): Promise<boolean> {
  if (!siamoSuProva(opz.supabaseUrl)) return false;
  if (!silenziabile(opz.payload)) return false;
  try {
    return (await opz.zittite()) === true;
  } catch {
    return false;
  }
}
