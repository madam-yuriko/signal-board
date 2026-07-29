import type { Organization } from "@/types";
import { ORG_STYLES } from "@/lib/format";

export default function OrgBadge({ org }: { org: Organization }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${ORG_STYLES[org]}`}
    >
      {org}
    </span>
  );
}
