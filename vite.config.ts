import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

const entry = process.env.VITE_ENTRY || "sidePanel";

const entries = {
  sidePanel: "src/webviews/side-panel/main.ts",
  modal: "src/webviews/modal/main.ts",
  settings: "src/webviews/settings/main.ts",
};

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("vscode-"),
        },
      },
    }),
  ],
  build: {
    outDir: `dist/webviews/${entry}`,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, entries[entry]),
      output: {
        entryFileNames: "main.js",
        assetFileNames: "style.[ext]",
        format: "iife",
      },
    },
  },
});
