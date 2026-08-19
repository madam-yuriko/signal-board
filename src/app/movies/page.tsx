import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";

export const revalidate = 86400;

export default async function MoviesPage() {
  const feed = await getTopicFeed("movie");
  return (
    <TopicDashboard
      domain="movie"
      title="映画情報"
      description="映画.comの上映中・公開予定作品を、公開状態と作品情報ごとに確認できます。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
    />
  );
}
