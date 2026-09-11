import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves tsconfig `paths` (the @/* alias) natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    // The engine is pure math with no DOM, so no jsdom environment is needed.
    environment: "node",
    include: ["lib/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
  },
});
