import AquariumDashboard from "@/components/AquariumDashboard";
import { listAquariumRecords } from "@/lib/aquariumDb";

export const dynamic = "force-dynamic";

export default function AquariumPage() {
  return <AquariumDashboard initialRecords={listAquariumRecords()} />;
}
