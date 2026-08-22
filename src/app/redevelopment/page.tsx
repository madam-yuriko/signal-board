import TopicDashboard from "@/components/TopicDashboard";
import { getTopicFeed } from "@/lib/topicFeed";
import type { TopicAreaTab } from "@/components/TopicDashboard";

const REDEVELOPMENT_AREA_TABS: TopicAreaTab[] = [
  { id: "新宿", label: "新宿" },
  { id: "丸の内・東京駅", label: "丸の内・東京駅" },
  { id: "渋谷", label: "渋谷" },
  { id: "品川・高輪", label: "品川・高輪" },
  { id: "その他東京", label: "その他東京" },
  { id: "札幌中央区", label: "札幌・中央区" },
  { id: "札幌その他", label: "札幌・その他" },
  { id: "北海道", label: "北海道" },
  { id: "東北", label: "東北" },
  { id: "関東（東京以外）", label: "関東（東京以外）" },
  { id: "中部", label: "中部" },
  { id: "関西", label: "関西" },
  { id: "中国・四国", label: "中国・四国" },
  { id: "九州", label: "九州" },
  { id: "spotlight", label: "その他注目（全国）" },
];

export const revalidate = 86400;

export default async function RedevelopmentPage() {
  const feed = await getTopicFeed("redevelopment");
  return (
    <TopicDashboard
      domain="redevelopment"
      title="再開発プロジェクト"
      description="東京・札幌は重点エリア別、その他地域は全国の注目プロジェクトを厳選して案件単位で確認できます。"
      items={feed.items}
      feedMode={feed.mode}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
      areaTabs={REDEVELOPMENT_AREA_TABS}
    />
  );
}
