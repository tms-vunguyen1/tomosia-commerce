import MerchantLoginForm from "@/layouts/merchant/shell/MerchantLoginForm";

interface SearchParams {
  next?: string;
}

export default async function MerchantLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--ground) p-4 text-(--ink)">
      <div className="w-full max-w-sm rounded-(--radius) border border-(--line) bg-(--card) p-6 shadow-(--shadow-sm)">
        <h1 className="text-[17px] font-semibold">Merchant login</h1>
        <p className="mt-2 text-[13px] text-(--ink-soft)">
          Sign in to open the merchant portal.
        </p>
        <div className="mt-5">
          <MerchantLoginForm next={next ?? null} />
        </div>
      </div>
    </div>
  );
}
