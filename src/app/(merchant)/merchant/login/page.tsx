interface SearchParams {
  next?: string;
}

// Stub for Task 3.1 — no form yet, just proves the middleware's redirect
// target renders. The real form (with the `next` value wired to it) lands
// in Task 3.3.
export default async function MerchantLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--ground) p-4 text-(--ink)">
      <div className="w-full max-w-sm rounded-(--radius) border border-(--line) bg-(--card) p-6 shadow-(--shadow-sm)">
        <h1 className="text-[17px] font-semibold">Merchant login</h1>
        <p className="mt-2 text-[13px] text-(--ink-soft)">
          The login form lands in the next task.
        </p>
      </div>
    </div>
  );
}
