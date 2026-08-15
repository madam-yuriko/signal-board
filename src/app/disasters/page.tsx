import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";

export const revalidate = 21600;

export default async function DisastersPage() {
  const feed = await getTopicFeed("disaster");
  return (
    <TopicDashboard
      domain="disaster"
      title="災害・防災"
      description="気象庁の地震・火山防災情報を、発表時刻と警戒状態ごとに確認できます。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
    />
  );
}
