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

interface CommonsImageInfo {
  thumburl?: string;
  url?: string;
}

interface CommonsPage {
  index?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

interface CommonsResponse {
  query?: { pages?: CommonsPage[] };
}

interface KnownTaxon {
  scientificName: string;
  imageSearchName?: string;
  taxonomyGroup: string;
  familyName: string;
  summary: string;
  maxSize: string;
  sourceUrl: string;
}

const KNOWN_TAXA: Record<string, KnownTaxon> = {
  ブエノスアイレステトラ: {
    scientificName: "Psalidodon anisitsi",
    imageSearchName: "Hyphessobrycon anisitsi",
    taxonomyGroup: "カラシン",
    familyName: "カラシン科",
    summary: "最大13.2cmまで記録される、見た目以上にしっかり大きくなる活発なテトラです。5匹以上の群れで飼うと落ち着きやすく、よく泳ぐため遊泳スペースを確保できる幅80cm以上の水槽が目安です。食性は雑食で、人工飼料を主食にしながら、冷凍・生餌や植物性の餌を少量混ぜると管理しやすくなります。柔らかい水草は食害されやすいので、植栽を主役にした水槽では硬い葉の水草を選ぶか、レイアウトへの影響を見込んでください。丈夫で人慣れしやすい一方、気性はかなり活発です。臆病な小型魚、ヒレの長い魚、餌取りの遅い魚との混泳では追い回しやヒレかじり、餌負けに注意し、同程度に活発で体格の近い魚を組み合わせるのが無難です。過密を避け、食べ残しを残さない給餌と安定した水質管理を心がけてください。",
    maxSize: "13.2cm（全長）",
    sourceUrl: "https://www.fishbase.se/summary/51004",
  },
  レッドライントーピードバルブ: {
    scientificName: "Sahyadria denisonii",
    taxonomyGroup: "コイ・ラスボラ",
    familyName: "コイ科",
    summary: "レッドライントーピードバルブは、全長約15cmになる大型で非常に活発な群泳魚です。単独では落ち着きにくいため、6匹以上の群れで飼い、長さ120cm以上を目安にした横長の水槽で十分な遊泳スペースを確保してください。食性は雑食で、人工飼料を基本に、冷凍・生餌や植物性の餌を混ぜると管理しやすくなります。性格は基本的に温和ですが泳力が高く、餌取りで小型魚を圧倒しやすいため、同程度に活発で丈夫な魚との混泳が向きます。原産地の流れを再現する強めの水流と高い溶存酸素量を好み、低酸素・高水温・よどんだ環境には注意が必要です。飛び出しやすいので、水槽には隙間の少ないふたを付けてください。",
    maxSize: "約15cm（全長）",
    sourceUrl: "https://en.aqua-fish.net/fish/denison-barb",
  },
};

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

const AQUARIUM_SUBJECT_PATTERN = /魚|水草|水生植物|藻類|エビ|海老|蝦|甲殻|貝|巻貝|軟体動物|腹足|サンゴ|珊瑚|イソギンチャク|両生類|カラシン|シクリッド|コイ目|ナマズ|メダカ|熱帯|淡水|海水|aquarium/i;

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

function isRelevantPage(page: WikiPage, name: string) {
  const content = `${page.title ?? ""} ${page.extract ?? ""}`;
  return pageScore(page, name) >= 20 && AQUARIUM_SUBJECT_PATTERN.test(content);
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

function extractMaxSize(extract: string): string | undefined {
  const match = extract.match(/(?:最大(?:全長|体長)?|全長|体長)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(cm|センチメートル|mm)/i);
  if (!match) return undefined;
  const unit = match[2] === "センチメートル" ? "cm" : match[2];
  return `${match[1]}${unit}`;
}

function extractScientificName(extract: string): string | undefined {
  const match = extract.match(/(?:学名[：:]\s*|[（(])([A-Z][a-z]+(?:\s+[a-z][a-z-]+){1,2})/);
  return match?.[1];
}

function extractFamilyName(extract: string): string | undefined {
  return extract.match(/([ァ-ヴー]+科)/)?.[1];
}

function unavailableProfile(): AquariumProfile {
  return {
    taxonomyGroup: "未分類",
    summary: "公開情報を自動取得できませんでした。生体名を確認して保存し直すか、編集画面でWikipedia名を指定して再取得できます。",
  };
}

async function fetchCommonsImage(searchName: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: searchName,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1200",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SignalBoard/0.1 aquarium-profile" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as CommonsResponse;
    const searchKey = normalized(searchName);
    const page = [...(data.query?.pages ?? [])]
      .filter((item) => normalized(item.title ?? "").includes(searchKey))
      .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))[0];
    const url = page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url;
    return url && /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

async function knownTaxonProfile(name: string): Promise<AquariumProfile | undefined> {
  const taxon = KNOWN_TAXA[normalized(name)];
  if (!taxon) return undefined;
  const imageUrl = await fetchCommonsImage(taxon.imageSearchName ?? taxon.scientificName);
  return {
    taxonomyGroup: taxon.taxonomyGroup,
    familyName: taxon.familyName,
    scientificName: taxon.scientificName,
    summary: taxon.summary,
    maxSize: taxon.maxSize,
    sourceUrl: taxon.sourceUrl,
    imageUrl,
  };
}

export async function fetchAquariumProfile(name: string): Promise<AquariumProfile> {
  const known = await knownTaxonProfile(name);
  if (known) return known;
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
      .filter((item) => item.title && item.extract && isRelevantPage(item, name))
      .sort((a, b) => pageScore(b, name) - pageScore(a, name))[0];
    if (!page?.extract) return unavailableProfile();
    const sourceUrl = page.fullurl ?? (page.title
      ? `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
      : undefined);
    return {
      taxonomyGroup: classify(`${page.title ?? ""} ${page.extract}`),
      familyName: extractFamilyName(page.extract),
      scientificName: extractScientificName(page.extract),
      summary: shortSummary(page.extract),
      maxSize: extractMaxSize(page.extract),
      sourceUrl,
      imageUrl: page.thumbnail?.source ?? page.original?.source,
    };
  } catch {
    return unavailableProfile();
  }
}
