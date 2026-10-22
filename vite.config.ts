import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// "npm run build:demo" gera um único HTML no modo demonstração, para mostrar o app sem servidor.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  build: mode === "demo" ? { outDir: "dist-demo" } : {},
}));
