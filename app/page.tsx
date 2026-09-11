import { OddsCalculator } from "./_components/odds-calculator";

/**
 * Stays a Server Component so it can export `metadata`, which Next 16 supports only in
 * server components. All interactivity lives behind the single 'use client' boundary in
 * OddsCalculator; its children inherit that and need no directive of their own.
 */
export default function Page() {
  return <OddsCalculator />;
}
