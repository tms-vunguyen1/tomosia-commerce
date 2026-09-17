/**
 * How each kind of retail record shows: its label, icon, and tone.
 * Ported from the reference's lib/kinds.ts; icon values are react-icons/fa6
 * component names (rendered via the existing DynamicIcon helper) in place
 * of the reference's own hand-drawn icon keys — see docs/merchant-portal/spec.md.
 */

import type { ChangeStatus, InventoryAlert, ListingStatus, OrderIssue } from "./types";

export type Tone = "ok" | "warn" | "danger" | "info" | "violet" | "muted" | "accent";

export interface KindStyle {
  label: string;
  icon: string;
  tone: Tone;
}

export const ISSUE_KINDS: Record<OrderIssue["kind"], KindStyle> = {
  delayed: { label: "Delayed", icon: "FaTruck", tone: "warn" },
  return_spike: { label: "Return spike", icon: "FaRotateLeft", tone: "danger" },
  buyer_message: { label: "Buyer message", icon: "FaCommentDots", tone: "info" },
  damaged: { label: "Damaged", icon: "FaTriangleExclamation", tone: "danger" },
};

export const INVENTORY_KINDS: Record<InventoryAlert["kind"], KindStyle> = {
  low_stock: { label: "Low stock", icon: "FaBoxOpen", tone: "warn" },
  slow_mover: { label: "Slow mover", icon: "FaClock", tone: "muted" },
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  paused: { label: "Paused", tone: "muted" },
  draft: { label: "Draft", tone: "info" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  processing: { label: "Processing", tone: "muted" },
  shipped: { label: "Shipped", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "ok" },
  delayed: { label: "Delayed", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "muted" },
  return_initiated: { label: "Return requested", tone: "violet" },
  refunded: { label: "Refunded", tone: "ok" },
};

export const CHANGE_STATUS: Record<ChangeStatus, { label: string; tone: Tone }> = {
  staged: { label: "Awaiting approval", tone: "violet" },
  applied: { label: "Approved", tone: "ok" },
  discarded: { label: "Dismissed", tone: "muted" },
};
