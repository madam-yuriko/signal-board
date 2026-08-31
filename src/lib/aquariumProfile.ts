import type { AquariumProfile } from "@/types/aquarium";

interface WikiPage {
  index?: number;
  title?: string;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source?: string };
  original?: { source?: string };
}

interface WikiResponse {
  query?: { pages?: WikiPage[] };
}

const GROUP_RULES: Array<[string, RegExp]> = [
  ["カラシン", /カラシン|テトラ|ペンシルフィッシュ|ハチェットフィッシュ/i],
  ["シクリッド", /シクリッド|カワスズメ科|ティラピア|アピストグラマ|ディスカス|エンゼルフィッシュ/i],
  ["コイ・ラスボラ", /コイ目|コイ科|ラスボラ|ダニオ|バルブ|アカヒレ/i],
  ["ナマズ・プレコ", /ナマズ目|ナマズ科|コリドラス|プレコ|オトシンクルス/i],
  ["メダカ・卵胎生メダカ", /メダカ科|グッピー|プラティ|モーリー|ソードテール|カダヤシ科/i],
  ["ベタ・グラミー", /ベタ属|グラミー|オスフロネムス科|キノボリウオ亜目/i],
  ["レインボーフィッシュ", /レインボーフィッシュ|メラノタエニア科/i],
  ["フグ", /フグ目|フグ科|アベニーパファー/i],
  ["ハゼ", /ハゼ亜目|ハゼ科|ヨシノボリ/i],
  ["ドジョウ", /ドジョウ科|ローチ/i],
  ["古代魚", /アロワナ|ポリプテルス|ガー科|ハイギョ|古代魚/i],
  ["エビ", /エビ目|ヌマエビ|シュリンプ/i],
  ["貝・巻貝", /腹足綱|巻貝|イシマキガイ|タニシ/i],
  ["水草", /水草|水生植物|有茎草|陰性植物|ロゼット型/i],
];

function normalized(value: string) {
  return value.normalize("NFKC").replace(/[\s・･()（）「」『』]/g, "").toLocaleLowerCase("ja");
}

function pageScore(page: WikiPage, name: string) {
  const title = normalized(page.title ?? "");
  const target = normalized(name);
  let score = 0;
  if (title === target) score += 100;
  if (title.includes(target) || target.includes(title)) score += 30;
  if ((page.extract ?? "").includes(name)) score += 10;
  if (/曖昧さ回避/.test(page.extract ?? "")) score -= 100;
  return score - (page.index ?? 10);
}

function classify(text: string) {
  return GROUP_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "その他の生体";
}

function shortSummary(extract: string) {
  const clean = extract.replace(/\s+/g, " ").trim();
  if (clean.length <= 240) return clean;
  const sentences = clean.match(/[^。！？]+[。！？]?/g) ?? [clean];
  let result = "";
  for (const sentence of sentences) {
    if (result.length > 90 && result.length + sentence.length > 240) break;
    result += sentence;
  }
  return result.length > 240 ? `${result.slice(0, 237)}…` : result;
}

function unavailableProfile(): AquariumProfile {
  return {
    taxonomyGroup: "未分類",
    summary: "公開情報を自動取得できませんでした。生体名を確認して保存し直すと、情報を再取得できます。",
  };
}

export async function fetchAquariumProfile(name: string): Promise<AquariumProfile> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: name,
    gsrnamespace: "0",
    gsrlimit: "5",
    prop: "extracts|pageimages|info",
    exintro: "1",
    explaintext: "1",
    exsectionformat: "plain",
    piprop: "thumbnail|original",
    pithumbsize: "1200",
    pilicense: "free",
    inprop: "url",
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  try {
    const response = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SignalBoard/0.1 aquarium-profile" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailableProfile();
    const data = await response.json() as WikiResponse;
    const page = [...(data.query?.pages ?? [])]
      .filter((item) => item.title && item.extract)
      .sort((a, b) => pageScore(b, name) - pageScore(a, name))[0];
    if (!page?.extract) return unavailableProfile();
    const sourceUrl = page.fullurl ?? (page.title
      ? `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
      : undefined);
    return {
      taxonomyGroup: classify(`${page.title ?? ""} ${page.extract}`),
      summary: shortSummary(page.extract),
      sourceUrl,
      imageUrl: page.thumbnail?.source ?? page.original?.source,
    };
  } catch {
    return unavailableProfile();
  }
}
