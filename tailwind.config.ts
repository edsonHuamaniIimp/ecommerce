// tailwind.config.ts
import { iimpPreset } from "@nrivera-iimp/ui-kit-iimp/preset";

const config = {
  presets: [iimpPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@nrivera-iimp/ui-kit-iimp/dist/**/*.{js,mjs}",
  ],
};

export default config;
