import BoxingDashboard from "@/components/BoxingDashboard";
import { getBoxingFeed } from "@/lib/boxingFeed";

export const revalidate = 21600;

export default async function BoxingPage() {
  const feed = await getBoxingFeed();
  return (
    <BoxingDashboard
      events={feed.events}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
      warning={feed.warning}
    />
  );
}
