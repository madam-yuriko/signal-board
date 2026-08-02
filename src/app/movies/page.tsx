import TopicDashboard from "@/components/TopicDashboard";
import { movies } from "@/data/movies";

export default function MoviesPage() {
  return (
    <TopicDashboard
      domain="movie"
      title="映画情報"
      description="劇場公開・公開予定・配信中の作品を、ジャンルや公開状態ごとに確認できるモックボードです。"
      items={movies}
    />
  );
}
