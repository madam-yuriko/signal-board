"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  Fish,
  Hash,
  HeartPulse,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Ruler,
  Search,
  Store,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import DataViewToolbar, { type DataViewMode } from "@/components/DataViewToolbar";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { AquariumRecord } from "@/types/aquarium";

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatPrice(value?: number) {
  return value === undefined ? "—" : `${value.toLocaleString("ja-JP")}円`;
}

function totalPrice(record: AquariumRecord) {
  return record.unitPrice === undefined ? undefined : record.unitPrice * record.quantity;
}

function durationLabel(record: AquariumRecord) {
  const start = new Date(`${record.acquiredDate}T00:00:00`);
  const end = new Date(`${record.deathDate ?? today()}T00:00:00`);
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
  if (days < 31) return `${days}日`;
  if (days < 365) return `${Math.floor(days / 30)}か月 ${days % 30}日`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return `${years}年${months > 0 ? ` ${months}か月` : ""}`;
}

function imageUrl(record: AquariumRecord) {
  if (record.hasUploadedPhoto) {
    return `/api/aquarium/photos/${record.id}?v=${encodeURIComponent(record.photoUpdatedAt ?? record.updatedAt)}`;
  }
  return record.externalImageUrl;
}

function Metric({ icon: Icon, label, value }: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/7 bg-black/15 px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] text-gray-500"><Icon className="h-3 w-3" />{label}</div>
      <div className="truncate text-xs font-semibold text-gray-200">{value}</div>
    </div>
  );
}

function AquariumCard({ record, onEdit, onDelete }: {
  record: AquariumRecord;
  onEdit: (record: AquariumRecord) => void;
  onDelete: (record: AquariumRecord) => void;
}) {
  const photo = imageUrl(record);
  return (
    <article className="glass-card group overflow-hidden rounded-xl">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-cyan-950/70 via-slate-900 to-emerald-950/50">
        {photo ? (
          <Image src={photo} alt={`${record.name}の写真`} fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-200/30"><Fish className="h-14 w-14" /><span className="mt-2 text-[10px] tracking-[0.2em]">PHOTO NOT FOUND</span></div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent p-3">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-950/70 px-2 py-1 text-[10px] font-semibold text-cyan-100 backdrop-blur">{record.taxonomyGroup}</span>
          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold backdrop-blur ${record.deathDate ? "border-gray-400/25 bg-black/55 text-gray-300" : "border-emerald-400/30 bg-emerald-950/70 text-emerald-200"}`}>{record.deathDate ? "死亡" : "飼育中"}</span>
        </div>
        {!record.hasUploadedPhoto && record.externalImageUrl && <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/60">WEB IMAGE</span>}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="truncate text-base font-bold text-white">{record.name}</h2><p className="mt-0.5 text-[10px] text-cyan-400/70">{record.taxonomyGroup}として自動分類</p></div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onEdit(record)} aria-label={`${record.name}を編集`} className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-cyan-200"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onDelete(record)} aria-label={`${record.name}を削除`} className="rounded-md p-1.5 text-gray-500 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Metric icon={CalendarDays} label="購入日" value={formatDate(record.acquiredDate)} />
          <Metric icon={HeartPulse} label={record.deathDate ? "生存期間" : "飼育期間"} value={durationLabel(record)} />
          <Metric icon={Store} label="購入店舗" value={record.store ?? "未登録"} />
          <Metric icon={CircleDollarSign} label="1匹あたり" value={formatPrice(record.unitPrice)} />
          <Metric icon={Hash} label="購入数" value={`${record.quantity}匹`} />
          <Metric icon={Ruler} label="最大サイズ" value={record.maxSize ?? "未取得"} />
          <Metric icon={Waves} label="水槽" value={record.tank ?? "未登録"} />
          <Metric icon={CircleDollarSign} label="購入総額" value={formatPrice(totalPrice(record))} />
          {record.deathDate && <Metric icon={CalendarDays} label="死亡日" value={formatDate(record.deathDate)} />}
        </div>

        <div className="mt-3 border-t border-white/7 pt-3">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-wide text-cyan-300/80">飼育メモ（自動要約）</h3>
          <p className="text-[11px] leading-[1.75] text-gray-400">{record.profileSummary}</p>
          {record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-300">出典を確認 <ExternalLink className="h-3 w-3" /></a>}
        </div>
        {record.notes && <p className="mt-3 rounded-md border border-white/6 bg-white/[0.025] px-2.5 py-2 text-[10px] leading-relaxed text-gray-500">備考：{record.notes}</p>}
      </div>
    </article>
  );
}

function Field({ label, required, className = "", hint, children }: { label: string; required?: boolean; className?: string; hint?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-[11px] font-semibold text-gray-400">{label}{required && <span className="ml-1 text-cyan-400">*</span>}{hint && <span className="ml-2 font-normal text-gray-600">{hint}</span>}</span>{children}</label>;
}

const inputClass = "h-9 w-full rounded-md border border-white/10 bg-black/25 px-2.5 text-xs text-gray-100 outline-none transition-colors placeholder:text-gray-700 focus:border-cyan-400/50";
const areaClass = "w-full rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-xs leading-relaxed text-gray-100 outline-none transition-colors placeholder:text-gray-700 focus:border-cyan-400/50";

function RecordEditor({ record, onClose, onSaved }: { record?: AquariumRecord; onClose: () => void; onSaved: (record: AquariumRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [photoName, setPhotoName] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch(record ? `/api/aquarium?id=${record.id}` : "/api/aquarium", { method: record ? "PUT" : "POST", body: new FormData(event.currentTarget) });
      const payload = await response.json() as { record?: AquariumRecord; error?: string };
      if (!response.ok || !payload.record) throw new Error(payload.error ?? "保存できませんでした。");
      onSaved(payload.record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できませんでした。");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="aquarium-editor-title">
      <div className="my-auto w-full max-w-2xl rounded-xl border border-white/10 bg-[#12141a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div><h2 id="aquarium-editor-title" className="text-sm font-bold text-white">{record ? "生体記録を編集" : "新しい生体を登録"}</h2><p className="mt-0.5 text-[10px] text-gray-500">種族・特徴・ネット写真は生体名から自動取得します。</p></div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-white/5 hover:text-white" aria-label="閉じる"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="生体の名前" required className="sm:col-span-2" hint="この名前で情報を検索します"><input name="name" required defaultValue={record?.name} placeholder="例：ネオンテトラ" className={inputClass} /></Field>
            <Field label="購入日" required><CalendarDatePicker name="acquiredDate" required defaultValue={record?.acquiredDate ?? today()} /></Field>
            <Field label="購入店舗名"><input name="store" defaultValue={record?.store} placeholder="例：アクアショップ○○" className={inputClass} /></Field>
            <Field label="購入数" required><input type="number" min="1" name="quantity" required defaultValue={record?.quantity ?? 1} className={inputClass} /></Field>
            <Field label="購入価格（1匹あたり）"><div className="relative"><input type="number" min="0" name="unitPrice" defaultValue={record?.unitPrice} placeholder="0" className={`${inputClass} pr-8`} /><span className="absolute right-2.5 top-2.5 text-[10px] text-gray-600">円</span></div></Field>
            <Field label="水槽名"><input name="tank" defaultValue={record?.tank} placeholder="例：リビング60cm水槽" className={inputClass} /></Field>
            <Field label="死亡日" hint="飼育中なら空欄"><CalendarDatePicker name="deathDate" allowClear defaultValue={record?.deathDate} /></Field>
            <Field label="写真" className="sm:col-span-2" hint="未登録ならネット写真を表示">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-white/12 bg-black/15 p-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-cyan-400/25 bg-cyan-400/8 px-3 py-2 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/12"><ImagePlus className="h-3.5 w-3.5" />写真を選ぶ<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => setPhotoName(event.target.files?.[0]?.name)} /></label>
                <span className="text-[10px] text-gray-500">{photoName ?? (record?.hasUploadedPhoto ? "登録済みの写真を使用" : "JPEG / PNG / WebP / GIF・8MBまで")}</span>
                {record?.hasUploadedPhoto && <label className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-gray-500"><input type="checkbox" name="removePhoto" value="true" className="accent-rose-400" />写真を削除してネット写真に戻す</label>}
              </div>
            </Field>
            <Field label="備考" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={record?.notes} placeholder="個体の特徴、購入時の様子など" className={areaClass} /></Field>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-gray-500"><Waves className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />保存時に公開情報を検索します。取得した短い特徴本文とネット写真には出典リンクを表示します。</div>
          {error && <p role="alert" className="mt-3 rounded-md border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-[11px] text-rose-200">{error}</p>}
          <div className="mt-4 flex justify-end gap-2 border-t border-white/7 pt-4">
            <button type="button" onClick={onClose} className="h-9 rounded-md border border-white/10 px-4 text-xs font-semibold text-gray-400 hover:bg-white/5">キャンセル</button>
            <button type="submit" disabled={saving} className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60">{saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}{saving ? "情報を取得中…" : record ? "更新する" : "登録する"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AquariumTable({ records, onEdit, onDelete }: { records: AquariumRecord[]; onEdit: (record: AquariumRecord) => void; onDelete: (record: AquariumRecord) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/8 bg-white/[0.02]">
      <table className="w-full min-w-[1120px] border-collapse text-left text-[11px]">
        <thead className="border-b border-white/8 bg-white/[0.035] text-[10px] font-semibold text-gray-500"><tr><th className="px-3 py-2.5">生体</th><th className="px-3 py-2.5">最大サイズ</th><th className="px-3 py-2.5">購入日</th><th className="px-3 py-2.5">購入店舗</th><th className="px-3 py-2.5 text-right">1匹あたり</th><th className="px-3 py-2.5 text-center">購入数</th><th className="px-3 py-2.5 text-right">購入総額</th><th className="px-3 py-2.5">水槽</th><th className="px-3 py-2.5">生存情報</th><th className="px-3 py-2.5">期間</th><th className="w-20 px-3 py-2.5"></th></tr></thead>
        <tbody className="divide-y divide-white/[0.055]">{records.map((record) => <tr key={record.id} className="text-gray-300 hover:bg-white/[0.025]">
          <td className="px-3 py-2.5"><div className="font-semibold text-white">{record.name}</div><div className="text-[10px] text-cyan-600">{record.taxonomyGroup}</div></td><td className="whitespace-nowrap px-3 py-2.5 text-cyan-100/80">{record.maxSize ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(record.acquiredDate)}</td><td className="max-w-40 truncate px-3 py-2.5">{record.store ?? "—"}</td><td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatPrice(record.unitPrice)}</td><td className="px-3 py-2.5 text-center tabular-nums">{record.quantity}</td><td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatPrice(totalPrice(record))}</td><td className="max-w-36 truncate px-3 py-2.5">{record.tank ?? "—"}</td>
          <td className="px-3 py-2.5">{record.deathDate ? <div><span className="text-gray-400">死亡</span><div className="text-[10px] tabular-nums text-gray-600">{formatDate(record.deathDate)}</div></div> : <span className="text-emerald-300">飼育中</span>}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-cyan-200">{durationLabel(record)}</td>
          <td className="px-3 py-2.5"><div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(record)} className="rounded p-1.5 text-gray-500 hover:bg-white/8 hover:text-cyan-200" aria-label={`${record.name}を編集`}><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onDelete(record)} className="rounded p-1.5 text-gray-500 hover:bg-rose-400/10 hover:text-rose-300" aria-label={`${record.name}を削除`}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export default function AquariumDashboard({ initialRecords }: { initialRecords: AquariumRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<DataViewMode>("cards");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [survival, setSurvival] = useState<"all" | "alive" | "dead">("all");
  const [editor, setEditor] = useState<AquariumRecord | "new" | undefined>();

  const groups = useMemo(() => [...new Set(records.map((record) => record.taxonomyGroup))].sort((a, b) => a.localeCompare(b, "ja")), [records]);
  const filtered = useMemo(() => records.filter((record) => {
    const haystack = [record.name, record.taxonomyGroup, record.maxSize, record.store, record.tank, record.notes, record.profileSummary].filter(Boolean).join(" ").toLocaleLowerCase("ja");
    return (group === "all" || record.taxonomyGroup === group) && (survival === "all" || (survival === "dead") === Boolean(record.deathDate)) && (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase("ja")));
  }), [group, query, records, survival]);

  const aliveQuantity = records.filter((record) => !record.deathDate).reduce((sum, record) => sum + record.quantity, 0);
  const totalSpent = records.reduce((sum, record) => sum + (totalPrice(record) ?? 0), 0);

  async function remove(record: AquariumRecord) {
    if (!window.confirm(`「${record.name}」の記録を削除しますか？`)) return;
    const response = await fetch(`/api/aquarium?id=${record.id}`, { method: "DELETE" });
    if (response.ok) setRecords((current) => current.filter((item) => item.id !== record.id)); else setError("記録を削除できませんでした。");
  }

  function saved(record: AquariumRecord) {
    setRecords((current) => {
      const exists = current.some((item) => item.id === record.id);
      return (exists ? current.map((item) => item.id === record.id ? record : item) : [record, ...current]).sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate) || b.id - a.id);
    });
    setEditor(undefined);
  }

  return <div className="space-y-4">
    <section className="relative overflow-hidden rounded-xl border border-cyan-400/10 bg-gradient-to-r from-cyan-950/35 via-[#11151b] to-emerald-950/25 px-4 py-5 sm:px-5"><div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-cyan-400/8 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-cyan-400/80"><Waves className="h-3.5 w-3.5" />AQUARIUM LOG</div><h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">アクアリウム管理</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-gray-400">購入情報と生存記録は手入力。種族、最大サイズ、飼育メモ、写真は生体名から自動で補完します。</p></div><button type="button" onClick={() => setEditor("new")} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/40 hover:bg-cyan-300"><Plus className="h-4 w-4" />新しく登録</button></div></section>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric icon={Fish} label="登録記録" value={`${records.length}件`} /><Metric icon={HeartPulse} label="飼育中の匹数" value={`${aliveQuantity}匹`} /><Metric icon={Waves} label="自動分類された種族" value={`${groups.length}種族`} /><Metric icon={CircleDollarSign} label="購入金額合計" value={formatPrice(totalSpent)} /></section>

    <DataViewToolbar mode={view} onModeChange={setView} count={filtered.length}><div className="relative min-w-[180px] flex-1 sm:w-64 sm:flex-none"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="生体・店舗・水槽を検索" aria-label="記録を検索" className="h-7 w-full rounded-md border border-white/10 bg-black/20 pl-8 pr-2 text-[11px] outline-none placeholder:text-gray-700 focus:border-cyan-400/40" /></div><select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="種族で絞り込み" className="h-7 rounded-md border border-white/10 bg-[#111319] px-2 text-[10px] text-gray-300 outline-none"><option value="all">すべての種族</option>{groups.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={survival} onChange={(event) => setSurvival(event.target.value as typeof survival)} aria-label="生存状態で絞り込み" className="h-7 rounded-md border border-white/10 bg-[#111319] px-2 text-[10px] text-gray-300 outline-none"><option value="all">すべての状態</option><option value="alive">飼育中</option><option value="dead">死亡</option></select></DataViewToolbar>

    {error && <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-xs text-rose-200">{error}</div>}
    {filtered.length === 0 ? <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/8 text-cyan-300"><Fish className="h-7 w-7" /></div><h2 className="mt-4 text-sm font-bold text-gray-200">{records.length === 0 ? "最初の生体を登録しましょう" : "条件に合う記録がありません"}</h2><p className="mt-1.5 text-[11px] text-gray-600">{records.length === 0 ? "名前を入力すれば、種族や特徴を自動で調べます。" : "検索や絞り込み条件を変えてください。"}</p>{records.length === 0 && <button type="button" onClick={() => setEditor("new")} className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 bg-cyan-400/8 px-3 py-2 text-[11px] font-semibold text-cyan-200"><Plus className="h-3.5 w-3.5" />記録を追加</button>}</section> : view === "cards" ? <div className="responsive-card-grid">{filtered.map((record) => <AquariumCard key={record.id} record={record} onEdit={setEditor} onDelete={(item) => void remove(item)} />)}</div> : <AquariumTable records={filtered} onEdit={setEditor} onDelete={(item) => void remove(item)} />}
    {editor && <RecordEditor key={editor === "new" ? "new" : editor.id} record={editor === "new" ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={saved} />}
  </div>;
}
