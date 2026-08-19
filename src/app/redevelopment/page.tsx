import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";

export const revalidate = 86400;

export default async function RedevelopmentPage() {
  const feed = await getTopicFeed("redevelopment");
  return (
    <TopicDashboard
      domain="redevelopment"
      title="再開発プロジェクト"
      description="東京都都市整備局の報道発表から、都市整備・再開発に関係する更新をまとめています。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
    />
  );
}
