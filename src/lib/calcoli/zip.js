/**
 * Un lettore di archivi .zip, il minimo indispensabile.
 *
 * Serve perché la banca consegna il flusso CBI dentro uno zip: chiedere
 * ad Alessio di estrarlo a mano ogni volta sarebbe un passaggio in più
 * su un gesto che si fa spesso. Il browser sa già decomprimere
 * (`DecompressionStream`), quindi basta leggere l'indice dell'archivio:
 * nessuna libreria nel pacchetto.
 *
 * Legge l'indice CENTRALE (in fondo al file), non le intestazioni locali:
 * è lì che stanno le misure vere quando lo zip è stato scritto «in
 * streaming» e le intestazioni locali dicono zero.
 *
 * ⚠️ Non legge archivi cifrati né zip64 (oltre 4 GB): un flusso CBI pesa
 * pochi kilobyte. Li rifiuta con una frase invece di restituire niente.
 */

function u16(b, p) {
  return b[p] | (b[p + 1] << 8);
}
function u32(b, p) {
  return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
}

/** È uno zip? (i primi quattro byte: «PK\3\4») */
export function eZip(bytes) {
  return bytes.length >= 4 && u32(bytes, 0) === 0x04034b50;
}

async function gonfia(dati) {
  const flusso = new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flusso).arrayBuffer());
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<{ nome: string, contenuto: Uint8Array }[]>} i soli file, non le cartelle
 */
export async function leggiZip(bytes) {
  // La fine dell'indice centrale: cercata all'indietro (può seguire un commento).
  let fineIndice = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
    if (u32(bytes, p) === 0x06054b50) {
      fineIndice = p;
      break;
    }
  }
  if (fineIndice < 0) throw new Error("L'archivio .zip è rovinato o incompleto.");
  const quanti = u16(bytes, fineIndice + 10);
  let p = u32(bytes, fineIndice + 16);
  const out = [];
  for (let i = 0; i < quanti; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error("L'archivio .zip è rovinato o incompleto.");
    const opzioni = u16(bytes, p + 8);
    const metodo = u16(bytes, p + 10);
    const compressa = u32(bytes, p + 20);
    const lNome = u16(bytes, p + 28);
    const lExtra = u16(bytes, p + 30);
    const lCommento = u16(bytes, p + 32);
    const locale = u32(bytes, p + 42);
    const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + lNome));
    p += 46 + lNome + lExtra + lCommento;
    if (nome.endsWith("/")) continue;
    if (opzioni & 1) throw new Error("L'archivio .zip è protetto da password: estrai il file a mano.");
    if (compressa === 0xffffffff || locale === 0xffffffff) throw new Error("L'archivio .zip è troppo grande per essere letto qui.");
    if (u32(bytes, locale) !== 0x04034b50) throw new Error("L'archivio .zip è rovinato o incompleto.");
    const inizio = locale + 30 + u16(bytes, locale + 26) + u16(bytes, locale + 28);
    const dati = bytes.subarray(inizio, inizio + compressa);
    if (dati.length !== compressa) throw new Error("L'archivio .zip è troncato.");
    let contenuto;
    if (metodo === 0) contenuto = dati;
    else if (metodo === 8) contenuto = await gonfia(dati);
    else throw new Error(`L'archivio .zip usa una compressione che qui non si legge (metodo ${metodo}).`);
    out.push({ nome, contenuto });
  }
  return out;
}
