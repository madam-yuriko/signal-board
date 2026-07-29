import type { BoxingEvent } from "@/types";

/**
 * 興行の「代表画像」を解決するヘルパー。
 *
 * 画像はすべて Wikimedia Commons の自由利用可能なファイル（ホットリンク可）。
 * - 著名選手は本人写真を使用。
 * - それ以外は雰囲気のあるボクシング汎用画像を、興行 ID から決定的に割り当てる
 *   （同じ興行は常に同じ画像／隣り合うタイルが被りにくいよう分散）。
 * - event.image が明示されていればそれを最優先で使う。
 */

/** メインイベント選手名 → 本人写真（Wikimedia Commons） */
const FIGHTER_IMAGES: Record<string, string> = {
  井上尚弥:
    "https://upload.wikimedia.org/wikipedia/commons/4/49/Naoya_Inoue_20230302suports_03.jpg",
};

/** メイン選手の写真が無いときに使うボクシング汎用画像（800〜960px サムネ） */
const FALLBACK_IMAGES: string[] = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/MGM_Pacquiao_vs._Hatton_pre-fight_ring.jpg/960px-MGM_Pacquiao_vs._Hatton_pre-fight_ring.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Boxing_ring_at_the_2012_Summer_Olympics_%282%29.jpg/960px-Boxing_ring_at_the_2012_Summer_Olympics_%282%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/KSI_vs_Fury_during_their_boxing_match.jpg/960px-KSI_vs_Fury_during_their_boxing_match.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/US_Navy_030402-N-1485H-001_U.S._Navy_boxing_team_member%2C_Steelworker_1st_Class_Keith_Spencer_from_Newark%2C_N.J._%28right%29_in_the_ring_during_a_championship_fight_held_during_the_National_Boxing_Tournament.jpg/960px-thumbnail.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Boxing_banner.jpg/960px-Boxing_banner.jpg",
];

function mainFighter(event: BoxingEvent): string {
  const main = event.bouts.find((b) => b.isMainEvent) ?? event.bouts[0];
  return main?.jpFighter ?? "";
}

/** 文字列から決定的な非負整数ハッシュ */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 興行の代表画像 URL を返す */
export function eventImageUrl(event: BoxingEvent): string {
  if (event.image) return event.image;

  const fighter = mainFighter(event);
  if (FIGHTER_IMAGES[fighter]) return FIGHTER_IMAGES[fighter];

  return FALLBACK_IMAGES[hash(event.id) % FALLBACK_IMAGES.length];
}
