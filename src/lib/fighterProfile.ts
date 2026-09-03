export type FighterStance = "オーソドックス" | "サウスポー";

/** Wikipediaで確認できた選手プロフィール。値が無い項目は推測で補わない。 */
export interface FighterProfile {
  fighterKey: string;
  fighterName: string;
  birthDate?: string;
  stance?: FighterStance;
  /** 日本出身選手について、Wikipediaから都道府県まで判別できた場合のみ保存する。 */
  birthplacePrefecture?: string;
  sourceUrl: string;
  updatedAt: string;
}

export function ageOnDate(
  birthDate: string | undefined,
  today = new Date(),
): number | undefined {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
  const [year, month, day] = birthDate.split("-").map(Number);
  const age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  return age - (birthdayPassed ? 0 : 1);
}
