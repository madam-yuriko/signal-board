import TopicDashboard from "@/components/TopicDashboard";
import { redevelopments } from "@/data/redevelopments";

export default function RedevelopmentPage() {
  return (
    <TopicDashboard
      domain="redevelopment"
      title="再開発プロジェクト"
      description="都市開発を案件単位で確認。計画、工事、段階開業までの状態と直近の更新をまとめています。"
      items={redevelopments}
    />
  );
}
