import TopicDashboard from "@/components/TopicDashboard";
import { disasters } from "@/data/disasters";

export default function DisastersPage() {
  return (
    <TopicDashboard
      domain="disaster"
      title="災害・防災"
      description="災害事象を地域単位で確認する訓練用ビュー。警戒状態、影響範囲、更新履歴をまとめています。"
      items={disasters}
    />
  );
}
