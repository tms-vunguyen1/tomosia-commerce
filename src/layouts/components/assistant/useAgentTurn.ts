"use client";

/**
 * One turn's event stream, reduced into the transcript the modal renders.
 *
 * Ported from `examples/web-shared/turn.ts` of anthropics/commerce-agents: cards are
 * keyed by slot rather than by tool_use id, so a retry reuses the same DOM node, and a
 * card that arrives as a burst of `ui_partial` frames is paced one item at a time
 * instead of appearing all at once.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorCode, resolveError } from "@/lib/assistant/errors";
import { ApiRequestError, type AssistantApi } from "./api";
import {
  AgentEvent,
  AssistantChatItem,
  AssistantSegment,
  ChatItem,
  CHIPS_COMPONENT,
  ToolCallData,
  TraceEntry,
  UIBlock,
  UISlotStatus,
} from "./protocol";

/** Pace between structural items when a burst arrives at once. */
const DRIP_MS = 180;
/** Pace once the final payload is waiting behind the queue. */
const FAST_DRIP_MS = 80;
/** Queue depth above which every second frame is dropped. */
const MAX_QUEUE = 8;
/** The arrays a partial payload grows, in the order the server counts them. */
const STRUCTURAL_KEYS = ["items", "entries", "steps", "sections"] as const;

const TOOL_COPY: Record<string, string> = {
  search_products: "Searching the catalogue…",
  get_product_details: "Reading the product details…",
  get_cart: "Checking the cart…",
  add_to_cart: "Adding to the cart…",
  update_cart_item: "Updating the cart…",
  remove_from_cart: "Removing from the cart…",
  get_preferences: "Looking at your profile…",
  get_orders: "Looking up your orders…",
  get_order_status: "Checking that order…",
  search_policies: "Reading the store's policies…",
  // No save_memory/recall_memories copy: memory is off (shopping_assistant/config.py),
  // so those tools only ever answer that it is off — "Saving that…" would be a lie.
  read_skill: "Working out how to help…",
};

export function describeToolCall(tool: string, input: Record<string, unknown>) {
  if (tool === "search_products" && typeof input.query === "string") {
    return `Searching for “${input.query}”…`;
  }
  return TOOL_COPY[tool] ?? "Working…";
}

function structuralCount(block: UIBlock): number {
  const payload = block.payload as Record<string, unknown>;
  for (const key of STRUCTURAL_KEYS) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

function structuralPrefix(block: UIBlock, count: number): UIBlock {
  const payload = block.payload as Record<string, unknown>;
  for (const key of STRUCTURAL_KEYS) {
    const value = payload?.[key];
    if (Array.isArray(value)) {
      return {
        ...block,
        payload: { ...payload, [key]: value.slice(0, count) },
      };
    }
  }
  return block;
}

function eventBlock(event: AgentEvent): UIBlock {
  return {
    component: String(event.data.component ?? ""),
    payload: event.data.payload ?? {},
  };
}

interface Slot {
  key: string;
  component: string;
  streamId?: string;
  status: UISlotStatus;
  rendered: number;
  queue: UIBlock[];
  timer: number | null;
  final: UIBlock | null;
}

export interface AgentTurn {
  items: ChatItem[];
  ready: boolean;
  busy: boolean;
  send: (text: string) => Promise<void>;
  /** Replies that have finished; the cart is re-read when this moves. */
  completed: number;
  trace: TraceEntry[];
}

export function useAgentTurn(
  api: AssistantApi,
  options: { sessionId: string | null },
): AgentTurn {
  const { sessionId } = options;
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const turnRef = useRef(0);
  const slotsRef = useRef<Map<string, Slot>>(new Map());
  const slotByStream = useRef<Map<string, string>>(new Map());
  const ordinals = useRef<Map<string, number>>(new Map());
  // Prose on both sides of a tool call shares a segment; the boundary gets a break.
  const afterToolRef = useRef(false);
  const progressToolRef = useRef<string | null>(null);
  // The self-recursive pacing timer reaches itself through a ref, so the callback does
  // not close over its own binding.
  const drainRef = useRef<((turn: number, slot: Slot) => void) | null>(null);

  const clearTimers = useCallback(() => {
    for (const slot of slotsRef.current.values()) {
      if (slot.timer != null) window.clearTimeout(slot.timer);
      slot.timer = null;
    }
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const updateTurn = useCallback(
    (turn: number, update: (item: AssistantChatItem) => AssistantChatItem) => {
      setItems((previous) =>
        previous.map((item) =>
          item.kind === "assistant" && item.turn === turn ? update(item) : item,
        ),
      );
    },
    [],
  );

  const appendTrace = useCallback((entry: Omit<TraceEntry, "at">) => {
    setTrace((previous) => [...previous, { ...entry, at: performance.now() }]);
  }, []);

  const commit = useCallback(
    (turn: number, slot: Slot, block: UIBlock, status: UISlotStatus) => {
      slot.status = status;
      slot.rendered = structuralCount(block);
      updateTurn(turn, (item) => {
        const segments = [...item.segments];
        const index = segments.findIndex(
          (segment) => segment.type === "ui" && segment.slotKey === slot.key,
        );
        const segment: AssistantSegment = {
          type: "ui",
          block,
          slotKey: slot.key,
          status,
        };
        if (index >= 0) segments[index] = segment;
        else segments.push(segment);
        return {
          ...item,
          segments,
          activity: status === "pending" ? item.activity : undefined,
        };
      });
    },
    [updateTurn],
  );

  const drain = useCallback(
    (turn: number, slot: Slot) => {
      slot.timer = null;
      const next = slot.queue.shift();
      if (next) {
        commit(turn, slot, next, "partial");
        if (slot.queue.length || slot.final) {
          const interval = slot.final ? FAST_DRIP_MS : DRIP_MS;
          slot.timer = window.setTimeout(
            () => drainRef.current?.(turn, slot),
            interval,
          );
        }
      } else if (slot.final) {
        const block = slot.final;
        slot.final = null;
        commit(turn, slot, block, "final");
      }
    },
    [commit],
  );
  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  /** Cuts a partial into one-item steps so a burst lands item by item. */
  const schedule = useCallback(
    (turn: number, slot: Slot, block: UIBlock) => {
      const incoming = structuralCount(block);
      const queued = slot.queue[slot.queue.length - 1];
      const tail = queued ? structuralCount(queued) : slot.rendered;
      if (!slot.queue.length && slot.timer == null && incoming <= tail + 1) {
        commit(turn, slot, block, "partial");
        return;
      }
      if (slot.queue.length && incoming <= tail) {
        slot.queue[slot.queue.length - 1] = block;
        return;
      }
      for (let count = tail + 1; count < incoming; count++) {
        slot.queue.push(structuralPrefix(block, count));
      }
      slot.queue.push(block);
      if (slot.queue.length > MAX_QUEUE) {
        slot.queue = slot.queue.filter(
          (_, index, all) => index % 2 === 1 || index === all.length - 1,
        );
      }
      if (slot.timer != null) return;
      // The first frame shows at once; only growth is paced.
      if (slot.status === "pending") drain(turn, slot);
      else slot.timer = window.setTimeout(() => drain(turn, slot), DRIP_MS);
    },
    [commit, drain],
  );

  const flush = useCallback(
    (turn: number) => {
      for (const slot of slotsRef.current.values()) {
        if (slot.timer != null) window.clearTimeout(slot.timer);
        slot.timer = null;
        const last = slot.final ?? slot.queue[slot.queue.length - 1];
        const status: UISlotStatus = slot.final ? "final" : slot.status;
        slot.queue = [];
        slot.final = null;
        if (last) commit(turn, slot, last, status);
      }
    },
    [commit],
  );

  const openSlot = useCallback(
    (
      turn: number,
      component: string,
      status: UISlotStatus,
      streamId?: string,
    ) => {
      const ordinal = ordinals.current.get(component) ?? 0;
      ordinals.current.set(component, ordinal + 1);
      const slot: Slot = {
        key: `${turn}-${component}-${ordinal}`,
        component,
        streamId,
        status,
        rendered: 0,
        queue: [],
        timer: null,
        final: null,
      };
      slotsRef.current.set(slot.key, slot);
      if (streamId) slotByStream.current.set(streamId, slot.key);
      return slot;
    },
    [],
  );

  const findSlot = useCallback(
    (component: string, statuses?: UISlotStatus[]) => {
      let found: Slot | undefined;
      for (const slot of slotsRef.current.values()) {
        if (slot.component !== component) continue;
        if (!statuses || statuses.includes(slot.status)) found = slot;
      }
      return found;
    },
    [],
  );

  const handleEvent = useCallback(
    (turn: number, event: AgentEvent) => {
      switch (event.type) {
        case "text_delta": {
          const delta = String(event.data.text ?? "");
          const afterTool = afterToolRef.current;
          afterToolRef.current = false;
          progressToolRef.current = null;
          updateTurn(turn, (item) => {
            const segments = [...item.segments];
            const last = segments[segments.length - 1];
            if (last?.type === "text") {
              const spaced = /\s$/.test(last.text) || /^\s/.test(delta);
              const gap = afterTool && last.text && !spaced ? "\n\n" : "";
              segments[segments.length - 1] = {
                type: "text",
                text: last.text + gap + delta,
              };
            } else {
              segments.push({ type: "text", text: delta });
            }
            return { ...item, segments, activity: undefined };
          });
          return;
        }
        case "ui_partial": {
          const block = eventBlock(event);
          if (block.component === CHIPS_COMPONENT) return;
          const streamId = String(event.data.stream_id ?? "");
          const known = slotByStream.current.get(streamId);
          let slot = known ? slotsRef.current.get(known) : undefined;
          if (!slot) {
            // A new attempt adopts the component's failed slot, else opens a new card.
            slot = findSlot(block.component, ["pending", "retrying"]);
            if (slot) {
              if (slot.timer != null) window.clearTimeout(slot.timer);
              slot.timer = null;
              slot.queue = [];
              slot.final = null;
              slot.rendered = 0;
              slot.status = "pending";
              slot.streamId = streamId;
            } else {
              slot = openSlot(turn, block.component, "pending", streamId);
            }
            slotByStream.current.set(streamId, slot.key);
          }
          schedule(turn, slot, block);
          return;
        }
        case "ui": {
          const block = eventBlock(event);
          if (block.component === CHIPS_COMPONENT) {
            const payload = block.payload as { suggestions?: string[] };
            updateTurn(turn, (item) => ({
              ...item,
              activity: undefined,
              suggestions: payload.suggestions ?? [],
            }));
            return;
          }
          const streamId = event.data.stream_id
            ? String(event.data.stream_id)
            : undefined;
          const known = streamId
            ? slotByStream.current.get(streamId)
            : undefined;
          const slot =
            (known ? slotsRef.current.get(known) : undefined) ??
            findSlot(
              block.component,
              streamId ? ["pending", "retrying"] : undefined,
            ) ??
            openSlot(turn, block.component, "final", streamId);
          if (streamId) {
            slot.streamId = streamId;
            slotByStream.current.set(streamId, slot.key);
          }
          if (slot.queue.length && slot.timer != null) {
            slot.final = block;
          } else {
            if (slot.timer != null) window.clearTimeout(slot.timer);
            slot.timer = null;
            slot.queue = [];
            slot.final = null;
            commit(turn, slot, block, "final");
          }
          return;
        }
        case "tool_call": {
          afterToolRef.current = true;
          progressToolRef.current = null;
          const data = event.data as Partial<ToolCallData>;
          const tool = String(data.tool ?? "tool");
          const input = data.input ?? {};
          const label = typeof data.label === "string" ? data.label.trim() : "";
          updateTurn(turn, (item) => ({
            ...item,
            tools: [...item.tools, tool],
            activity: label || describeToolCall(tool, input),
          }));
          appendTrace({
            kind: "tool_call",
            turn,
            label: tool,
            detail: JSON.stringify(input),
          });
          return;
        }
        case "tool_result": {
          const tool = String(event.data.tool ?? "tool");
          if (progressToolRef.current === tool) {
            progressToolRef.current = null;
            updateTurn(turn, (item) => ({ ...item, activity: undefined }));
          }
          if (event.data.is_error) {
            // Streamed frames stay, dimmed, for the retry to adopt.
            const key = slotByStream.current.get(String(event.data.id ?? ""));
            const slot = key ? slotsRef.current.get(key) : undefined;
            if (slot?.status === "partial") {
              if (slot.timer != null) window.clearTimeout(slot.timer);
              slot.timer = null;
              const last = slot.queue[slot.queue.length - 1];
              slot.queue = [];
              slot.final = null;
              slot.status = "retrying";
              updateTurn(turn, (item) => ({
                ...item,
                segments: item.segments.map((segment) =>
                  segment.type === "ui" && segment.slotKey === slot.key
                    ? {
                        ...segment,
                        block: last ?? segment.block,
                        status: "retrying",
                      }
                    : segment,
                ),
              }));
            }
          }
          appendTrace({
            kind: "tool_result",
            turn,
            label: tool,
            detail: String(event.data.summary ?? ""),
            isError: Boolean(event.data.is_error),
            status: event.data.status ? String(event.data.status) : undefined,
            reason: event.data.reason ? String(event.data.reason) : undefined,
            // Sent when the summary is only "ok": the head of the fenced result the
            // model actually read.
            excerpt:
              typeof event.data.excerpt === "string"
                ? event.data.excerpt
                : undefined,
          });
          return;
        }
        case "progress": {
          const message = String(event.data.message ?? "").trim();
          if (!message) return;
          progressToolRef.current = event.data.tool
            ? String(event.data.tool)
            : null;
          updateTurn(turn, (item) => ({ ...item, activity: message }));
          return;
        }
        case "error": {
          const code =
            typeof event.data.code === "string" ? event.data.code : undefined;
          const text = code
            ? resolveError(code)
            : String(event.data.message ?? "Something went wrong.");
          updateTurn(turn, (item) => ({
            ...item,
            segments: [...item.segments, { type: "error", text }],
          }));
          appendTrace({
            kind: "error",
            turn,
            label: "error",
            detail: text,
            isError: true,
          });
          return;
        }
        default:
          return;
      }
    },
    [appendTrace, commit, findSlot, openSlot, schedule, updateTurn],
  );

  const runTurn = useCallback(
    async (userText: string, events: AsyncIterable<AgentEvent>) => {
      const turn = ++turnRef.current;
      const startedAt = performance.now();
      clearTimers();
      slotsRef.current = new Map();
      slotByStream.current = new Map();
      ordinals.current = new Map();
      afterToolRef.current = false;
      progressToolRef.current = null;
      setItems((previous) => [
        ...previous,
        { kind: "user", text: userText },
        {
          kind: "assistant",
          turn,
          segments: [],
          suggestions: [],
          pending: true,
          tools: [],
        },
      ]);
      try {
        for await (const event of events) {
          if (event.type === "turn_complete") {
            const usage = (event.data.usage ?? {}) as Record<string, number>;
            const n = (value?: number) => (value ?? 0).toLocaleString("en-US");
            appendTrace({
              kind: "turn_complete",
              turn,
              label: "turn complete",
              detail:
                `in ${n(usage.input_tokens)} · out ${n(usage.output_tokens)}` +
                ` · cache read ${n(usage.cache_read_input_tokens)}`,
              elapsedMs: performance.now() - startedAt,
            });
          } else {
            handleEvent(turn, event);
          }
        }
      } catch (thrown) {
        const text = resolveError(
          thrown instanceof ApiRequestError
            ? thrown.code
            : ErrorCode.ASSISTANT_UNREACHABLE,
        );
        updateTurn(turn, (item) =>
          item.segments.length
            ? item
            : { ...item, segments: [{ type: "error", text }] },
        );
      } finally {
        // Partials freeze as they are; unadopted skeletons and failed slots go.
        flush(turn);
        updateTurn(turn, (item) => ({
          ...item,
          pending: false,
          activity: undefined,
          segments: item.segments
            .filter(
              (segment) =>
                segment.type !== "ui" ||
                (segment.status !== "pending" && segment.status !== "retrying"),
            )
            .map((segment) =>
              segment.type === "ui" && segment.status === "partial"
                ? { ...segment, status: "final" as const }
                : segment,
            ),
        }));
        setCompleted((count) => count + 1);
      }
    },
    [appendTrace, clearTimers, flush, handleEvent, updateTurn],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !sessionId) return;
      setBusy(true);
      await runTurn(message, api.chatStream(message));
      setBusy(false);
    },
    [api, busy, sessionId, runTurn],
  );

  return { items, ready: sessionId != null, busy, send, completed, trace };
}
