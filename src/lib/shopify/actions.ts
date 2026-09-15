"use server";

import {
  getCollectionProducts as getCollectionProductsQuery,
  getProducts as getProductsQuery,
} from ".";
import { PageInfo, Product } from "./types";

// Everything exported here is reachable from the browser as a server action.
// Keep it to the product listing calls the infinite-scroll views need — the
// customer and cart functions must stay server-only, or they become
// unauthenticated endpoints.

export async function getProducts(args: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
  cursor?: string;
}): Promise<{ pageInfo: PageInfo; products: Product[] }> {
  return getProductsQuery(args);
}

export async function getCollectionProducts(args: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
  filterCategoryProduct?: any[];
}): Promise<{ pageInfo: PageInfo | null; products: Product[] }> {
  return getCollectionProductsQuery(args);
}
