import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const config: UserConfig = defineConfig({
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
      babel: {
        // plugins: ['styled-components'],
        babelrc: false,
        configFile: false,
      },
    }),
  ],
  optimizeDeps: {
    force: true,
  },
  build: {
    rollupOptions: {
      external: ["@monaco-editor/react"],
    },
  },
});
export default config;
