import Notice from "@/layouts/merchant/ui/Notice";
import PageHeader from "@/layouts/merchant/ui/PageHeader";
import Panel from "@/layouts/merchant/ui/Panel";
import Pill from "@/layouts/merchant/ui/Pill";
import Skeleton from "@/layouts/merchant/ui/Skeleton";

// Task 3 smoke check: every common primitive renders without error.
// Replaced by the real shell + Home view in Tasks 5-6.
export default function MerchantPortalPage() {
  return (
    <main className="flex flex-col gap-4 p-8">
      <PageHeader title="Merchant portal — under construction" subtitle="Task 3 primitive smoke check" />
      <Panel title="Panel" subtitle="with a subtitle">
        <div className="flex gap-2 px-[18px]">
          <Pill tone="ok">Active</Pill>
          <Pill tone="warn" dot>
            Low stock
          </Pill>
          <Pill tone="danger">Out of stock</Pill>
          <Pill tone="muted">Paused</Pill>
        </div>
      </Panel>
      <Skeleton className="h-24" />
      <Notice>The merchant API isn&apos;t reachable — this is a Notice.</Notice>
    </main>
  );
}
