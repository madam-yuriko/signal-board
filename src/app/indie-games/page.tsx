import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";

export const revalidate = 86400;

export default async function IndieGamesPage() {
  const feed = await getTopicFeed("indie-game");
  return (
    <TopicDashboard
      domain="indie-game"
      title="インディーゲーム情報"
      description="個人開発者・小規模スタジオの作品を、ジャンル・対応プラットフォーム・更新状況ごとに確認できます。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
    />
  );
}
