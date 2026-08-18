import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// L'APP AGGIUNTA ALLA SCHERMATA INIZIALE (18/08/2026, giro E).
//
// ⚠️ PERCHE' UNA PROVA SU DEI FILE FERMI. Un manifest che dichiara
// un'icona da 512 puntando a un file da 180 **non da' nessun errore**: il
// telefono la ridimensiona e si vede sgranata, e nessuno sa perche'. E' la
// stessa forma del vuoto che diventa zero: qualcosa di dichiarato che non
// corrisponde a quello che c'e', senza rumore.
//
// Queste prove leggono le misure VERE dall'intestazione dei PNG, non dal
// nome del file — un file rinominato passerebbe un controllo sul nome.

const radice = new URL("../../", import.meta.url);
const leggi = (p) => readFileSync(new URL(p, radice));
const manifest = JSON.parse(leggi("public/manifest.webmanifest").toString());
const html = leggi("index.html").toString();

const misuraPng = (percorso) => {
  const b = leggi(percorso);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
};

describe("L'app aggiunta alla schermata iniziale", () => {
  it("si apre senza le barre del browser — che è tutto il guadagno", () => {
    // 145 punti su 844, misurati sul telefono di Alessio. Senza
    // `standalone` l'icona resta un segnalibro e il giro E non guadagna
    // niente in altezza.
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });

  it("ogni icona dichiarata esiste davvero, e della misura che dichiara", () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icona of manifest.icons) {
      const vera = misuraPng(`public${icona.src}`);
      expect(vera, `${icona.src} non è un PNG leggibile`).not.toBeNull();
      expect(vera, `${icona.src} dichiara ${icona.sizes}`).toBe(icona.sizes);
    }
  });

  it("ce n'è una che il telefono può ritagliare a piacere", () => {
    // Android ritaglia le icone nella forma del suo sistema: senza una
    // `maskable`, il logo finisce tagliato ai bordi.
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("iOS trova la sua icona, che non passa dal manifest", () => {
    // ⚠️ iOS ignora il manifest per l'icona: legge `apple-touch-icon`. Un
    // manifest perfetto e questo tag mancante danno l'icona giusta su
    // Android e una fotografia della pagina su iPhone — cioè proprio sul
    // telefono per cui il giro E esiste.
    expect(html).toMatch(/rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"/);
    expect(misuraPng("public/apple-touch-icon.png")).toBe("180x180");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
  });
});
