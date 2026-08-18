// Le icone dell'app aggiunta alla schermata iniziale.
//
// ⚠️ PERCHE' UNO SCRIPT E NON TRE FILE INCOLLATI. Un'immagine binaria nel
// repository e' una cosa che fra sei mesi nessuno sa piu' da dove viene ne'
// come rifarla: se il logo cambia, o se serve una misura in piu', si
// ricomincia da capo a mano. Qui l'icona e' una CONSEGUENZA del logo vero
// di Alessio (`public/logo-borgo58.png`), e si rifa' con un comando.
//
// ⚠️ E il logo non e' quadrato (780 × 382): iOS e Android vogliono un
// quadrato, e ritagliarlo taglierebbe il nome. Quindi si CENTRA su un
// fondo color crema, dentro l'80% del lato — il margine che iOS e Android
// si tengono per arrotondare gli angoli senza mangiare il disegno.
//
// Uso:  node scripts/icone-app.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const CREMA = [0xfb, 0xf7, 0xee, 0xff]; // --color-b58-parchment
const SORGENTE = new URL("../public/logo-borgo58.png", import.meta.url);
const MISURE = [
  { file: "icona-512.png", lato: 512 },
  { file: "icona-192.png", lato: 192 },
  // iOS non legge il manifest per l'icona: guarda `apple-touch-icon`, e la
  // vuole PNG. 180 e' la misura dei telefoni a tre punti per pixel.
  { file: "apple-touch-icon.png", lato: 180 },
];

// --- Leggere un PNG a colori con trasparenza (tipo 6, 8 bit) ---
function leggiPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Non e' un PNG.");
  const larghezza = buf.readUInt32BE(16);
  const altezza = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) {
    throw new Error(`PNG non gestito: profondita' ${buf[24]}, tipo ${buf[25]}, interlacciato ${buf[28]}.`);
  }
  const pezzi = [];
  let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const tipo = buf.toString("ascii", o + 4, o + 8);
    if (tipo === "IDAT") pezzi.push(buf.subarray(o + 8, o + 8 + len));
    if (tipo === "IEND") break;
    o += 12 + len;
  }
  const grezzo = inflateSync(Buffer.concat(pezzi));
  const pixel = Buffer.alloc(larghezza * altezza * 4);
  const riga = larghezza * 4;
  for (let y = 0; y < altezza; y++) {
    const filtro = grezzo[y * (riga + 1)];
    const dentro = grezzo.subarray(y * (riga + 1) + 1, y * (riga + 1) + 1 + riga);
    for (let i = 0; i < riga; i++) {
      const a = i >= 4 ? pixel[y * riga + i - 4] : 0;
      const b = y > 0 ? pixel[(y - 1) * riga + i] : 0;
      const c = y > 0 && i >= 4 ? pixel[(y - 1) * riga + i - 4] : 0;
      let v = dentro[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filtro !== 0) throw new Error(`Filtro PNG sconosciuto: ${filtro}`);
      pixel[y * riga + i] = v & 0xff;
    }
  }
  return { larghezza, altezza, pixel };
}

function scriviPng(larghezza, altezza, pixel, dove) {
  const riga = larghezza * 4;
  const grezzo = Buffer.alloc((riga + 1) * altezza);
  for (let y = 0; y < altezza; y++) {
    grezzo[y * (riga + 1)] = 0; // nessun filtro: le icone sono piccole
    pixel.copy(grezzo, y * (riga + 1) + 1, y * riga, y * riga + riga);
  }
  const pezzo = (tipo, dati) => {
    const testa = Buffer.alloc(8);
    testa.writeUInt32BE(dati.length, 0);
    testa.write(tipo, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, "ascii"), dati])) >>> 0, 0);
    return Buffer.concat([testa, dati, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(
    dove,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pezzo("IHDR", ihdr),
      pezzo("IDAT", deflateSync(grezzo, { level: 9 })),
      pezzo("IEND", Buffer.alloc(0)),
    ])
  );
}

const TAVOLA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TAVOLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// --- Comporre: logo centrato su un quadrato crema, poi rimpicciolire ---
function icona(logo, lato) {
  // Il disegno occupa l'80% del lato: il resto e' il margine che i sistemi
  // si prendono per arrotondare.
  const scala = Math.min((lato * 0.8) / logo.larghezza, (lato * 0.8) / logo.altezza);
  const largo = Math.round(logo.larghezza * scala);
  const alto = Math.round(logo.altezza * scala);
  const offX = Math.round((lato - largo) / 2);
  const offY = Math.round((lato - alto) / 2);
  const out = Buffer.alloc(lato * lato * 4);
  for (let i = 0; i < lato * lato; i++) out.set(CREMA, i * 4);

  // Media di tutti i pixel di origine che cadono nel pixel di arrivo: senza,
  // un logo con del testo rimpicciolito di quattro volte diventa una riga
  // di puntini.
  for (let y = 0; y < alto; y++) {
    const y0 = Math.floor((y / alto) * logo.altezza);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) / alto) * logo.altezza));
    for (let x = 0; x < largo; x++) {
      const x0 = Math.floor((x / largo) * logo.larghezza);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) / largo) * logo.larghezza));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * logo.larghezza + sx) * 4;
          const alfa = logo.pixel[i + 3] / 255;
          r += logo.pixel[i] * alfa; g += logo.pixel[i + 1] * alfa; b += logo.pixel[i + 2] * alfa;
          a += alfa; n++;
        }
      }
      const copertura = a / n;
      const i = ((y + offY) * lato + (x + offX)) * 4;
      // Sopra il crema: il logo ha il fondo trasparente.
      out[i] = Math.round((a ? r / a : 0) * copertura + CREMA[0] * (1 - copertura));
      out[i + 1] = Math.round((a ? g / a : 0) * copertura + CREMA[1] * (1 - copertura));
      out[i + 2] = Math.round((a ? b / a : 0) * copertura + CREMA[2] * (1 - copertura));
      out[i + 3] = 255;
    }
  }
  return out;
}

const logo = leggiPng(readFileSync(SORGENTE));
for (const m of MISURE) {
  const dove = new URL(`../public/${m.file}`, import.meta.url);
  scriviPng(m.lato, m.lato, icona(logo, m.lato), dove);
  console.log(`  ${m.file} — ${m.lato}×${m.lato}`);
}
console.log(`Icone rifatte dal logo vero (${logo.larghezza}×${logo.altezza}).`);
