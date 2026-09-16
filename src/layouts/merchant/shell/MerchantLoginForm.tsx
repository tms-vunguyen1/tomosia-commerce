"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import Button from "@/layouts/merchant/ui/Button";

// Guards against an open redirect via a crafted ?next= — same check as
// src/middleware.ts's isSafeNextPath.
function isSafeNextPath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

export default function MerchantLoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/merchant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Invalid email or password");
        return;
      }

      router.push(isSafeNextPath(next) ? next : "/merchant");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-(--ink-soft)">Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-[10px] border border-(--line-strong) bg-(--card) px-3 py-[9px] text-[14px] text-(--ink) outline-none focus:border-(--accent)"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-(--ink-soft)">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-[10px] border border-(--line-strong) bg-(--card) px-3 py-[9px] text-[14px] text-(--ink) outline-none focus:border-(--accent)"
        />
      </label>

      {error ? (
        <p role="alert" className="text-[13px] font-medium text-(--danger)">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={loading} className="mt-1 justify-center">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
