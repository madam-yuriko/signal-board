import type { Organization } from "@/types";
import { ORGANIZATIONS } from "@/types";

const FOUR_WAY_UNIFICATION = /4\s*団体|undisputed|unified\s+(?:world\s+)?title/i;

/** Extract governing bodies, including shorthand for a four-way unification bout. */
export function organizationsFromText(value: string): Organization[] {
  const normalized = value.normalize("NFKC");
  const organizations = ORGANIZATIONS.filter((organization) =>
    normalized.toUpperCase().includes(organization),
  );

  if (FOUR_WAY_UNIFICATION.test(normalized)) {
    return [...ORGANIZATIONS];
  }

  return organizations;
}
