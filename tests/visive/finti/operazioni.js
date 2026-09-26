// Il corridoio delle operazioni, finto: nelle prove visive non si scrive
// niente. Risponde quello che la pagina di prova ha preparato, o niente.
export async function eseguiOperazione(operazione) {
  return window.__DATI_FINTI?.operazioni?.[operazione] ?? null;
}
