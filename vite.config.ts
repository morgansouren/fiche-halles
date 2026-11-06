import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages sert le site sous https://morgansouren.github.io/fiche-halles/
  // (un sous-dossier au nom du dépôt), pas à la racine du domaine : le
  // build doit donc préfixer chaque lien vers un fichier (JS, CSS,
  // favicon) par /fiche-halles/. En dev (`npm run dev`), on garde la
  // racine — localhost:5173 sert l'appli directement à `/`.
  base: command === 'build' ? '/fiche-halles/' : '/',
}))
