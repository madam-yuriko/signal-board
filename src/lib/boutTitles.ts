import type { Bout, BoutTitle, Organization } from "@/types";

function titleKey(title: BoutTitle): string {
  if (title.kind === "world") return `world:${title.organization}`;
  if (title.kind === "world-eliminator") {
    return `world-eliminator:${title.organization}`;
  }
  if (title.kind === "regional") return `regional:${title.label}`;
  return title.kind;
}

function uniqueTitles(titles: BoutTitle[]): BoutTitle[] {
  return [...new Map(titles.map((title) => [titleKey(title), title])).values()];
}

/**
 * 公式カードの試合見出しから、団体名と王座の格を分離する。
 * WBO-APやOPBFを世界王座へ昇格させないよう、地域王座を先に判定する。
 */
export function boutTitlesFromText(
  value: string,
  organizations: Organization[],
): BoutTitle[] {
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const titles: BoutTitle[] = [];

  if (
    /WBO\s*(?:[-‐‑–—]?\s*AP|ASIA(?:\s*PACIFIC)?|アジア(?:パシフィック|太平洋)?)/i.test(
      text,
    )
  ) {
    titles.push({ kind: "wbo-ap" });
  }
  if (/OPBF|東洋太平洋/i.test(text)) titles.push({ kind: "opbf" });

  if (/日本(?:女子)?ユース/i.test(text)) {
    titles.push({ kind: "japan-youth" });
  } else if (
    /日本(?:女子)?.{0,24}(?:王座|タイトル|統一|決定戦?)/i.test(text)
  ) {
    titles.push({ kind: "japan" });
  }

  for (const organization of organizations) {
    if (
      new RegExp(`${organization}\\s*(?:ASIA|アジア|ユース)`, "i").test(text) &&
      !(organization === "WBO" && titles.some((title) => title.kind === "wbo-ap"))
    ) {
      const regionalName = /ユース/i.test(text)
        ? `${organization}ユース`
        : `${organization} ASIA`;
      titles.push({ kind: "regional", label: regionalName });
    }
  }
  if (/\bABF\b/i.test(text)) {
    titles.push({ kind: "regional", label: "ABF" });
  }

  const worldEliminator =
    /(?:世界|WORLD).{0,32}挑戦者決定|挑戦者決定.{0,32}(?:世界|WORLD)/i.test(text);
  if (worldEliminator) {
    titles.push(
      ...organizations.map(
        (organization): BoutTitle => ({ kind: "world-eliminator", organization }),
      ),
    );
  }

  const worldTitle = /世界|WORLD/i.test(text) && !worldEliminator;
  if (worldTitle) {
    titles.push(
      ...organizations.map(
        (organization): BoutTitle => ({ kind: "world", organization }),
      ),
    );
  }

  const titleContext =
    /タイトル|王座|王者|防衛|挑戦|統一|決定戦|CHAMPION|TITLE/i.test(text);
  if (
    titles.length === 0 &&
    organizations.length > 0 &&
    (titleContext || text.length === 0)
  ) {
    // 既存の手入力済み世界戦は団体だけを持つものがある。
    titles.push(
      ...organizations.map(
        (organization): BoutTitle => ({ kind: "world", organization }),
      ),
    );
  }

  return uniqueTitles(titles.length > 0 ? titles : [{ kind: "non-title" }]);
}

export function titlesForBout(
  bout: Pick<Bout, "titles" | "notes" | "organizations">,
): BoutTitle[] {
  // 過去に「世界」とだけ分類済みのデータでも、公式見出しに挑戦者決定戦と
  // 明記されていれば、より具体的な分類を優先する。
  if (bout.notes && /挑戦者決定/.test(bout.notes)) {
    return boutTitlesFromText(bout.notes, bout.organizations);
  }
  if (bout.titles && bout.titles.length > 0) return bout.titles;
  return boutTitlesFromText(bout.notes ?? "", bout.organizations);
}

export function isWorldTitle(
  bout: Pick<Bout, "titles" | "notes" | "organizations">,
): boolean {
  return titlesForBout(bout).some((title) => title.kind === "world");
}

export function boutTitleLabel(title: BoutTitle): string {
  if (title.kind === "world") return `${title.organization}世界`;
  if (title.kind === "world-eliminator") {
    return `${title.organization}世界 挑戦者決定`;
  }
  if (title.kind === "wbo-ap") return "WBO-AP";
  if (title.kind === "opbf") return "OPBF";
  if (title.kind === "japan") return "日本タイトル";
  if (title.kind === "japan-youth") return "日本ユース";
  if (title.kind === "regional") return title.label;
  return "ノンタイトル";
}
