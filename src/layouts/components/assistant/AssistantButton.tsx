"use client";

import { useRef } from "react";
import { BsStars } from "react-icons/bs";
import AssistantModal, { AssistantModalHandle } from "./AssistantModal";

export default function AssistantButton() {
  const modalRef = useRef<AssistantModalHandle>(null);

  return (
    <>
      <button
        aria-label="Open shopping assistant"
        onClick={() => modalRef.current?.open()}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 dark:bg-darkmode-primary"
      >
        <BsStars className="text-2xl" />
      </button>
      <AssistantModal ref={modalRef} />
    </>
  );
}
