"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { FaXmark } from "react-icons/fa6";
import AssistantChat from "./AssistantChat";

export type AssistantModalHandle = {
  open: () => void;
};

const AssistantModal = forwardRef<AssistantModalHandle>((_props, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  // The assistant's session starts the first time the dialog is opened, not on page load.
  const [opened, setOpened] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpened(true);
      dialogRef.current?.showModal();
    },
  }));

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      aria-label="Shopping assistant"
      className="m-auto h-[95vh] max-h-[95vh] w-[95vw] max-w-8xl rounded-md border-none bg-body p-0 text-text-dark backdrop:bg-black/50 dark:bg-darkmode-body dark:text-white max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:rounded-none"
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-700">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold tracking-tight">
              Commerceplate
            </span>
            <span className="hidden text-base text-text-light sm:inline dark:text-darkmode-text-light">
              Shopping Assistant
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActivityOpen((open) => !open)}
              aria-pressed={activityOpen}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition hover:border-primary dark:hover:border-darkmode-primary ${
                activityOpen
                  ? "border-primary text-primary dark:border-darkmode-primary dark:text-darkmode-primary"
                  : "border-neutral-200 text-text-dark dark:border-neutral-700 dark:text-white"
              }`}
            >
              Activity
            </button>
            <button aria-label="Close shopping assistant" onClick={close}>
              <FaXmark className="h-7 transition-all ease-in-out hover:scale-110" />
            </button>
          </div>
        </div>
        <AssistantChat
          active={opened}
          activityOpen={activityOpen}
          onActivityClose={() => setActivityOpen(false)}
        />
      </div>
    </dialog>
  );
});

AssistantModal.displayName = "AssistantModal";

export default AssistantModal;
