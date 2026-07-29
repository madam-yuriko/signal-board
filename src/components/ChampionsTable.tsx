import type { Champion } from "@/types";
import OrgBadge from "@/components/OrgBadge";

export default function ChampionsTable({
  champions,
}: {
  champions: Champion[];
}) {
  return (
    <div className="glass-card overflow-hidden rounded-lg">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-3 py-2 font-semibold">階級</th>
            <th className="px-3 py-2 font-semibold">王者</th>
            <th className="px-3 py-2 font-semibold">団体</th>
            <th className="hidden px-3 py-2 font-semibold sm:table-cell">
              所属
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {champions.map((c) => (
            <tr
              key={`${c.name}-${c.weightClass}`}
              className="transition-colors hover:bg-white/5"
            >
              <td className="px-3 py-2 text-gray-300">{c.weightClass}</td>
              <td className="px-3 py-2 font-semibold text-white">{c.name}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {c.organizations.map((o) => (
                    <OrgBadge key={o} org={o} />
                  ))}
                </div>
              </td>
              <td className="hidden px-3 py-2 text-gray-400 sm:table-cell">
                {c.gym}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
