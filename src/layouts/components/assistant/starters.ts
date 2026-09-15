/**
 * The opening prompts. They are ordinary messages — the assistant answers them from the
 * live catalogue like anything else typed into the composer — chosen to land on one of
 * the five indexed flows apiece.
 */

export interface Starter {
  id: string;
  /** Short bold label on the card. */
  title: string;
  /** Emoji shown in the card's icon tile. */
  icon: string;
  /** The full prompt: shown as the card's description and sent when clicked. */
  label: string;
}

export const STARTERS: Starter[] = [
  {
    id: "search-discovery",
    title: "Find a lamp",
    icon: "💡",
    label: "I need a bedside lamp with a warm light, under $150.",
  },
  {
    id: "planning-goals",
    title: "Light a room",
    icon: "🛋️",
    label: "Help me light a small living room from scratch.",
  },
  {
    id: "purchase-research",
    title: "Compare two",
    icon: "⚖️",
    label: "Compare your pendant lights — which one suits a dining table?",
  },
  {
    id: "customer-care",
    title: "An order",
    icon: "📦",
    label: "Where is my last order, and what is your returns policy?",
  },
];
