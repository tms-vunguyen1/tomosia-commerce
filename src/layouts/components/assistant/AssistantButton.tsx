"use client";

import { useEffect, useRef, useState } from "react";
import { RiRobot2Fill } from "react-icons/ri";
import AssistantModal, { AssistantModalHandle } from "./AssistantModal";

export default function AssistantButton() {
  const modalRef = useRef<AssistantModalHandle>(null);
  const [showPing, setShowPing] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const pingTimer = setTimeout(() => setShowPing(false), 4000);
    return () => clearTimeout(pingTimer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes assistant-shake {
          0%,
          100% {
            transform: rotate(0deg);
          }
          15% {
            transform: rotate(-12deg);
          }
          30% {
            transform: rotate(10deg);
          }
          45% {
            transform: rotate(-8deg);
          }
          60% {
            transform: rotate(6deg);
          }
          75% {
            transform: rotate(-4deg);
          }
          90% {
            transform: rotate(2deg);
          }
        }
        .assistant-shake {
          animation: assistant-shake 0.6s ease-in-out;
        }
      `}</style>

      <div
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className={`rounded-full bg-black/80 px-3 py-1.5 text-sm font-medium text-white shadow-md transition-all duration-200 dark:bg-white/90 dark:text-black ${
            hovered
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-2 opacity-0"
          }`}
        >
          Chat with shopping agent
        </span>

        <button
          aria-label="Open shopping assistant"
          onClick={() => {
            setShowPing(false);
            modalRef.current?.open();
          }}
          className={`relative flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-purple-600 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-4 ring-primary/20 transition-transform duration-200 hover:scale-105 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)] active:scale-95 dark:from-darkmode-primary dark:to-purple-500 dark:ring-darkmode-primary/20 ${
            shake ? "assistant-shake" : ""
          }`}
        >
          {showPing && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 dark:bg-darkmode-primary/60" />
          )}

          <RiRobot2Fill className="relative z-10 text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />

          <span className="absolute -top-0.5 -right-0.5 z-10 flex size-4 items-center justify-center rounded-full bg-green-400 text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] ring-2 ring-white dark:ring-darkmode-body">
            AI
          </span>
        </button>
      </div>
      <AssistantModal ref={modalRef} />
    </>
  );
}
