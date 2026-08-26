import { hostname } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Il nome di QUESTA macchina, chiesto al sistema a ogni avvio.
//
// ⚠️ NON SI SCRIVE A MANO, ed è il motivo per cui questa riga esiste. Dal
// telefono, sulla rete privata Tailscale, il gestionale si apre col nome del
// computer invece che col numero — e Vite rifiuta ogni nome che non conosce
// («Blocked request. This host is not allowed»). Inchiodare qui il nome di
// oggi vorrebbe dire ritrovarsi bloccati il giorno che la macchina cambia
// nome, senza nessuno che si ricordi perché: *un nome scritto a mano è una
// frase destinata a diventare falsa*. Chiedendolo al sistema, segue la
// macchina da sé.
//
// ⚠️ Due forme, e servono tutt'e due: Windows restituisce il nome in
// maiuscolo, mentre l'intestazione che arriva dal browser è in minuscolo.
const nomeDiQuestaMacchina = [hostname(), hostname().toLowerCase()]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true espone il server sulla rete locale (non solo su localhost),
  // utile per testare da tablet/telefono in cucina — vedi brief §3.6.
  server: {
    host: true,
    // ⚠️ SI APRE IL DOMINIO DELLA RETE PRIVATA, NON UNA MACCHINA. `.ts.net` è
    // il dominio di Tailscale: copre il nome lungo di qualunque dispositivo
    // della sua rete, oggi e dopo una reinstallazione. Accanto c'è il nome
    // corto di questa macchina, che è la forma che il telefono manda quando
    // si digita solo «desktop-…» senza il resto.
    //
    // ⚠️ E NON SI METTE `true`, che vorrebbe dire «qualunque nome va bene»:
    // il controllo di Vite esiste per impedire che un sito qualsiasi aperto
    // nel browser si faccia rispondere da questo server. Resta acceso; si
    // apre solo dove serve.
    allowedHosts: ['.ts.net', ...nomeDiQuestaMacchina],
  },
})
