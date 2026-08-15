import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";

export const revalidate = 21600;

export default async function DashboardPage() {
  const feed = await getTopicFeed("hardware");
  return (
    <TopicDashboard
      domain="hardware"
      title="CPU・GPU・APU情報"
      description="AMD・NVIDIAなどの公式ニュースを、CPU・GPU・APUのカテゴリごとに確認できます。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
    />
  );
}
