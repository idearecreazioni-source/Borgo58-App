import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { eZip, leggiZip } from "../../src/lib/calcoli/zip";

// Il lettore minimo degli .zip della banca (24/10/2026). L'archivio si
// costruisce qui, byte per byte, nella stessa forma di quelli di Credem
// (un file solo, compresso con deflate) — provato anche su due veri.

function zip(voci, { cifrato = false } = {}) {
  const locali = [];
  const indice = [];
  let offset = 0;
  for (const { nome, testo, metodo = 8 } of voci) {
    const nomeB = Buffer.from(nome);
    const dati = metodo === 8 ? deflateRawSync(Buffer.from(testo)) : Buffer.from(testo);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(cifrato ? 1 : 0, 6);
    loc.writeUInt16LE(metodo, 8);
    loc.writeUInt16LE(nomeB.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(cifrato ? 1 : 0, 8);
    cen.writeUInt16LE(metodo, 10);
    cen.writeUInt32LE(dati.length, 20);
    cen.writeUInt32LE(Buffer.byteLength(testo), 24);
    cen.writeUInt16LE(nomeB.length, 28);
    cen.writeUInt32LE(offset, 42);
    locali.push(loc, nomeB, dati);
    indice.push(cen, nomeB);
    offset += loc.length + nomeB.length + dati.length;
  }
  const ind = Buffer.concat(indice);
  const fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0);
  fine.writeUInt16LE(voci.length, 8);
  fine.writeUInt16LE(voci.length, 10);
  fine.writeUInt32LE(ind.length, 12);
  fine.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locali, ind, fine]));
}

describe("lo zip della banca si apre", () => {
  it("un file compresso", async () => {
    const z = zip([{ nome: "flussicbi.txt", testo: " RH03032".repeat(50) }]);
    expect(eZip(z)).toBe(true);
    const [f] = await leggiZip(z);
    expect(f.nome).toBe("flussicbi.txt");
    expect(new TextDecoder().decode(f.contenuto)).toBe(" RH03032".repeat(50));
  });

  it("più file, compressi e no, le cartelle saltate", async () => {
    const z = zip([{ nome: "cartella/", testo: "", metodo: 0 }, { nome: "a.txt", testo: "uno", metodo: 0 }, { nome: "b.txt", testo: "due" }]);
    const f = await leggiZip(z);
    expect(f.map((x) => x.nome)).toEqual(["a.txt", "b.txt"]);
    expect(new TextDecoder().decode(f[1].contenuto)).toBe("due");
  });

  it("uno zip troncato si ferma", async () => {
    const z = zip([{ nome: "a.txt", testo: "uno" }]);
    await expect(leggiZip(z.subarray(0, z.length - 10))).rejects.toThrow(/rovinato/);
  });

  it("uno zip con password si ferma con una frase", async () => {
    await expect(leggiZip(zip([{ nome: "a.txt", testo: "uno" }], { cifrato: true }))).rejects.toThrow(/password/);
  });

  it("un file che non è uno zip", () => {
    expect(eZip(new TextEncoder().encode(" RH03032"))).toBe(false);
  });
});
