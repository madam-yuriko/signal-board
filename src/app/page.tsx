import TopicDashboard from "@/components/TopicDashboard";
import { hardware } from "@/data/hardware";

export default function DashboardPage() {
  return (
    <TopicDashboard
      domain="hardware"
      title="CPU・GPU・APU情報"
      description="デスクトップ向けプロセッサとグラフィックス製品を、カテゴリ・世代・用途ごとに確認できるモックボードです。"
      items={hardware}
    />
  );
}
