import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta del planner (idéntica al artifact original)
        noche: "#0a0f2e",
        listo: "#3b5bfd",
        proceso: "#12b3a8",
        terminado: "#f0a13a",
      },
    },
  },
  plugins: [],
};

export default config;
