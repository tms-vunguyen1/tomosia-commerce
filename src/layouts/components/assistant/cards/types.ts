import type { ApiError } from "@/lib/assistant/errors";
import type { AgentProduct } from "../protocol";

/** Resolves to null on success, or the error to show, in the code+params shape every
 * assistant route answers with (`src/lib/assistant/errors.ts`). */
export type AddToCart = (product: AgentProduct) => Promise<ApiError | null>;
