import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change "reading-log" below to match your actual GitHub repo name.
// GitHub Pages serves project sites from a subpath (yourname.github.io/repo-name),
// so Vite needs to know that subpath to build asset links correctly.
export default defineConfig({
  plugins: [react()],
  base: "/reading-log/",
});
