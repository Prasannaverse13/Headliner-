import { Suspense } from "react";
import PlanApp from "@/components/PlanApp";

export const metadata = { title: "Plan a tour | Headliner" };

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanApp />
    </Suspense>
  );
}
