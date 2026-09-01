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

interface JapaneseFishGuideEntry {
  enName?: string;
  jpName?: string;
  scientificName?: string;
  category?: string;
  difficulty?: string;
  size?: string;
  temperature?: string;
  minTankSize?: number;
}

interface AquaHermitSearchResult {
  id?: number;
  title?: string;
  url?: string;
  subtype?: string;
}

interface AquaHermitArticle {
  link?: string;
  content?: { rendered?: string };
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
  プリステラ: {
    scientificName: "Pristella maxillaris",
    taxonomyGroup: "カラシン",
    familyName: "カラシン科",
    summary: "プリステラは、透明感のある体と黒・黄・白のひれが特徴の、丈夫で温和な小型テトラです。5匹以上の群れで飼うと落ち着きやすく、遊泳スペースを確保できる60cm以上の水槽がひとつの目安になります。食性は雑食で、細かい人工飼料を主食に、冷凍・生餌を少量混ぜると体調と発色の維持に役立ちます。性格は平和的でコミュニティ水槽に合わせやすい一方、単独や少数では臆病になりやすいため、同種をまとめて導入するのが無難です。混泳相手は小型で温和な魚を中心にし、ヒレをつつく魚や大型魚との組み合わせは避けてください。丈夫な魚でも、導入直後は水質変化に注意し、少量ずつ給餌して食べ残しを残さないようにしましょう。",
    maxSize: "約5cm（全長）",
    sourceUrl: "https://www.fishbase.se/summary/pristella-maxillaris.html",
  },
  カージナルテトラ: {
    scientificName: "Paracheirodon axelrodi",
    taxonomyGroup: "カラシン",
    familyName: "カラシン科",
    summary: "カージナルテトラは、青い光沢と頭から尾まで続く赤い帯が魅力の、温和な群泳性の小型テトラです。5匹以上、できればまとまった数で飼うと本来の落ち着いた群泳が見られ、60cm以上の水槽では遊泳スペースと水質の安定を確保しやすくなります。小さな口に合う人工飼料を基本に、細かい冷凍・生餌を混ぜて少量ずつ与えてください。基本的に他魚を攻撃しませんが、体が小さいため大型魚や口に入るサイズの魚とは混泳させないことが大切です。新しく立ち上げたばかりの水槽よりも、水質が安定した環境の方が導入しやすく、急な水質変化や過密を避けると管理しやすくなります。餌食い、色の薄れ、群れから外れていないかを日常的な体調チェックの目安にしてください。",
    maxSize: "3.0cm（標準体長）",
    sourceUrl: "https://www.fishbase.se/summary/Paracheirodon-axelrodi.html",
  },
  ピクタスキャット: {
    scientificName: "Pimelodus pictus",
    taxonomyGroup: "ナマズ・プレコ",
    familyName: "ピメロディア科",
    summary: "ピクタスキャットは、銀色の体に黒いスポットが入る活発なナマズです。一般的な飼育下での成長は約11〜15cmが目安で、泳ぎが速いため、十分な遊泳スペースと水流を確保できる水槽が向きます。性格は基本的に温和で、同種や体格の近い魚とは合わせやすい一方、口に入るネオンテトラなどの小魚は餌になる可能性があります。餌は沈下性の人工飼料を中心に与えやすく、食欲が強いため、餌取りの遅い混泳魚に餌が行き渡るよう注意してください。丈夫な種とされますが、導入直後は水合わせを丁寧に行い、隠れ場所と安定した水質を用意すると落ち着きやすくなります。胸びれ・背びれの棘が網に引っ掛かりやすいため、すくう際は扱いにも注意が必要です。",
    maxSize: "約15cm（全長）",
    sourceUrl: "https://www.aquahermit.com/tropicalfish_enc/pimelodus_pictus",
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
    summary: "公開情報を自動取得できませんでした。生体名を確認して保存し直すか、編集画面で検索名を指定して再取得できます。",
  };
}

function guideTaxonomyGroup(category?: string) {
  const categories: Record<string, string> = {
    "コイ・ドジョウ": "コイ・ラスボラ",
    "コリドラス": "ナマズ・プレコ",
    "プレコ": "ナマズ・プレコ",
    "ナマズ": "ナマズ・プレコ",
    "メダカ": "メダカ・卵胎生メダカ",
  };
  return categories[category ?? ""] ?? category ?? "その他の生体";
}

function guideSummary(entry: JapaneseFishGuideEntry) {
  const facts = [
    entry.category && `日本語の淡水熱帯魚図鑑では${entry.category}に分類されています。`,
    entry.size && `成魚サイズの目安は${entry.size}です。`,
    entry.temperature && `飼育水温の目安は${entry.temperature}です。`,
    entry.minTankSize && `水槽は${entry.minTankSize}cm以上をひとつの目安にしてください。`,
    entry.difficulty && `飼育難易度は${entry.difficulty}として案内されています。`,
    "販売個体の状態や混泳相手を確認し、導入時は水合わせを丁寧に行ってください。",
  ].filter(Boolean);
  return facts.join("");
}

function guideEntries(html: string): JapaneseFishGuideEntry[] {
  const startMarker = '\\"fish\\":';
  const endMarker = '],\\"categories\\":';
  const start = html.indexOf(startMarker);
  const end = start === -1 ? -1 : html.indexOf(endMarker, start);
  if (end === -1) return [];

  try {
    const encoded = html.slice(start + startMarker.length, end + 1);
    const entries = JSON.parse(encoded.replace(/\\"/g, '"')) as unknown;
    return Array.isArray(entries) ? entries as JapaneseFishGuideEntry[] : [];
  } catch {
    return [];
  }
}

async function fetchJapaneseFishGuideProfile(name: string): Promise<AquariumProfile | undefined> {
  try {
    const response = await fetch("https://tropicalfishguide.jp/", {
      headers: { "User-Agent": "SignalBoard/0.1 aquarium-profile" },
      cache: "force-cache",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    const target = normalized(name);
    const entry = guideEntries(await response.text())
      .find((candidate) => candidate.jpName && normalized(candidate.jpName) === target);
    if (!entry?.jpName || !entry.enName) return undefined;

    const imageUrl = entry.scientificName ? await fetchCommonsImage(entry.scientificName) : undefined;
    return {
      taxonomyGroup: guideTaxonomyGroup(entry.category),
      scientificName: entry.scientificName,
      summary: guideSummary(entry),
      maxSize: entry.size,
      sourceUrl: `https://tropicalfishguide.jp/fish/${encodeURIComponent(entry.enName)}`,
      imageUrl,
    };
  } catch {
    return undefined;
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function scientificNameFromUrl(url?: string) {
  const slug = url?.split("/").filter(Boolean).at(-1);
  if (!slug || !/^[a-z]+[_-][a-z-]+$/.test(slug)) return undefined;
  const [genus, species] = slug.split(/[_-]/, 2);
  return `${genus.charAt(0).toUpperCase()}${genus.slice(1)} ${species}`;
}

function aquariumArticleSummary(name: string, text: string, group: string, size?: string) {
  const facts = [
    `${name}は${group}の仲間として紹介されています。`,
    size && `最大サイズの目安は${size}です。`,
    /温厚|穏やか/.test(text) && "性格は基本的に温和とされますが、泳ぎが活発な個体は混泳相手を追うことがあります。",
    /小魚|ネオンテトラ/.test(text) && "口に入る小魚は餌になる可能性があるため、混泳相手のサイズには注意してください。",
    /沈下性/.test(text) && "餌は沈下性の人工飼料を中心に与えると食べやすい傾向があります。",
    /雑食|何でもよく食べ/.test(text) && "食性は幅広く、食べ残しを出さない少量給餌を基本にします。",
    /丈夫|飼いやすい/.test(text) && "丈夫な種とされますが、導入直後は水合わせを丁寧に行い、水質を安定させてください。",
    /夜行性/.test(text) && "夜行性の傾向があるため、隠れ場所を用意すると落ち着きやすくなります。",
  ].filter(Boolean);
  return facts.join("");
}

function extractArticleSize(text: string) {
  const match = text.match(/(?:最大サイズ|一般的に|飼育下)[^\d]{0,30}(\d+(?:[〜～~\-]\d+)?\s*cm)/i);
  return match?.[1]?.replace(/\s/g, "");
}

async function fetchAquaHermitProfile(name: string): Promise<AquariumProfile | undefined> {
  try {
    const params = new URLSearchParams({ search: name, per_page: "10", subtype: "tropicalfish_enc" });
    const searchResponse = await fetch(`https://www.aquahermit.com/wp-json/wp/v2/search?${params}`, {
      headers: { "User-Agent": "SignalBoard/0.1 aquarium-profile" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!searchResponse.ok) return undefined;
    const target = normalized(name);
    const result = (await searchResponse.json() as AquaHermitSearchResult[])
      .find((candidate) => candidate.id && candidate.subtype === "tropicalfish_enc" && normalized(candidate.title ?? "").includes(target));
    if (!result?.id) return undefined;

    const articleResponse = await fetch(`https://www.aquahermit.com/wp-json/wp/v2/tropicalfish_enc/${result.id}`, {
      headers: { "User-Agent": "SignalBoard/0.1 aquarium-profile" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!articleResponse.ok) return undefined;
    const article = await articleResponse.json() as AquaHermitArticle;
    const text = htmlToText(article.content?.rendered ?? "");
    if (!text) return undefined;

    const classifiedGroup = classify(text);
    // このエンドポイントは熱帯魚図鑑専用。本文に水草の語が含まれても水草としては扱わない。
    const taxonomyGroup = classifiedGroup === "水草" ? "その他の生体" : classifiedGroup;
    const maxSize = extractArticleSize(text);
    const scientificName = scientificNameFromUrl(article.link ?? result.url);
    const imageUrl = await fetchCommonsImage(scientificName ?? name);
    return {
      taxonomyGroup,
      scientificName,
      summary: aquariumArticleSummary(name, text, taxonomyGroup, maxSize),
      maxSize,
      sourceUrl: article.link ?? result.url,
      imageUrl,
    };
  } catch {
    return undefined;
  }
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

async function fetchJapaneseWikipediaProfile(name: string): Promise<AquariumProfile | undefined> {
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
    if (!response.ok) return undefined;
    const data = await response.json() as WikiResponse;
    const page = [...(data.query?.pages ?? [])]
      .filter((item) => item.title && item.extract && isRelevantPage(item, name))
      .sort((a, b) => pageScore(b, name) - pageScore(a, name))[0];
    if (!page?.extract) return undefined;
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
    return undefined;
  }
}

export async function fetchAquariumProfile(name: string, fallbackName?: string): Promise<AquariumProfile> {
  const known = await knownTaxonProfile(name);
  if (known) return known;

  const knownFallback = fallbackName ? await knownTaxonProfile(fallbackName) : undefined;
  if (knownFallback) return knownFallback;

  const wikipedia = await fetchJapaneseWikipediaProfile(name);
  if (wikipedia) return wikipedia;

  const guide = await fetchJapaneseFishGuideProfile(name);
  if (guide) return guide;

  const guideFallback = fallbackName ? await fetchJapaneseFishGuideProfile(fallbackName) : undefined;
  if (guideFallback) return guideFallback;

  const aquaHermit = await fetchAquaHermitProfile(name);
  if (aquaHermit) return aquaHermit;

  const aquaHermitFallback = fallbackName ? await fetchAquaHermitProfile(fallbackName) : undefined;
  return aquaHermitFallback ?? unavailableProfile();
}
