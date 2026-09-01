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

function durationBetween(startValue: string, endValue: string) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
  if (days < 31) return `${days}日`;
  if (days < 365) return `${Math.floor(days / 30)}か月 ${days % 30}日`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return `${years}年${months > 0 ? ` ${months}か月` : ""}`;
}

function livingCount(record: AquariumRecord) {
  return Math.max(0, record.quantity - record.deathRecords.length);
}

function lastDeathDate(record: AquariumRecord) {
  return record.deathRecords.at(-1)?.date;
}

function durationLabel(record: AquariumRecord) {
  return durationBetween(record.acquiredDate, livingCount(record) === 0 ? lastDeathDate(record) ?? today() : today());
}

function imageUrl(record: AquariumRecord) {
  if (record.hasUploadedPhoto) {
    return `/api/aquarium/photos/${record.id}?v=${encodeURIComponent(record.photoUpdatedAt ?? record.updatedAt)}`;
  }
  return record.externalImageUrl;
}

function organismType(record: AquariumRecord) {
  return record.taxonomyGroup === "水草" ? "水草" : "熱帯魚";
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

function FilterTagGroup({ label, allLabel = "すべて", options, selected, onSelect }: {
  label: string;
  allLabel?: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {[{ value: "all", label: allLabel }, ...options].map((option) => {
          const active = selected === option.value;
          return <button key={option.value} type="button" onClick={() => onSelect(option.value)} aria-pressed={active} className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${active ? "border-cyan-400/45 bg-cyan-400/15 text-cyan-100" : "border-white/8 text-gray-500 hover:text-gray-300"}`}>{option.label}</button>;
        })}
      </div>
    </div>
  );
}

function AquariumCard({ record, onEdit, onDelete }: {
  record: AquariumRecord;
  onEdit: (record: AquariumRecord) => void;
  onDelete: (record: AquariumRecord) => void;
}) {
  const photo = imageUrl(record);
  const living = livingCount(record);
  const fullyDeceased = living === 0;
  return (
    <article className="glass-card group overflow-hidden rounded-xl">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-cyan-950/70 via-slate-900 to-emerald-950/50">
        {photo ? (
          <Image src={photo} alt={`${record.name}の写真`} fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-200/30"><Fish className="h-14 w-14" /><span className="mt-2 text-[10px] tracking-[0.2em]">PHOTO NOT FOUND</span></div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent p-3">
          <div className="flex flex-wrap gap-1"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold backdrop-blur ${organismType(record) === "水草" ? "border-emerald-300/25 bg-emerald-950/70 text-emerald-100" : "border-cyan-300/20 bg-cyan-950/70 text-cyan-100"}`}>{organismType(record)}</span><span className="rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-semibold text-gray-300 backdrop-blur">{record.taxonomyGroup}</span></div>
          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold backdrop-blur ${fullyDeceased ? "border-gray-400/25 bg-black/55 text-gray-300" : "border-emerald-400/30 bg-emerald-950/70 text-emerald-200"}`}>{fullyDeceased ? "全個体死亡" : `飼育中 ${living}/${record.quantity}`}</span>
        </div>
        {!record.hasUploadedPhoto && record.externalImageUrl && <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/60">WEB IMAGE</span>}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="truncate text-base font-bold text-white">{record.name}</h2><div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">{record.familyName && <span>科：{record.familyName}</span>}{record.scientificName && <span>学名：<em className="text-gray-400">{record.scientificName}</em></span>}</div></div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onEdit(record)} aria-label={`${record.name}を編集`} className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-cyan-200"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onDelete(record)} aria-label={`${record.name}を削除`} className="rounded-md p-1.5 text-gray-500 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Metric icon={CalendarDays} label="購入日" value={formatDate(record.acquiredDate)} />
          <Metric icon={HeartPulse} label={fullyDeceased ? "最終生存期間" : "飼育期間"} value={durationLabel(record)} />
          <Metric icon={Store} label="購入店舗" value={record.store ?? "未登録"} />
          <Metric icon={CircleDollarSign} label="1匹あたり（税込）" value={formatPrice(record.unitPrice)} />
          <Metric icon={Hash} label="購入数" value={`${record.quantity}匹`} />
          <Metric icon={HeartPulse} label="現在の飼育数" value={`${living}匹`} />
          <Metric icon={Ruler} label="最大サイズ" value={record.maxSize ?? "未取得"} />
          <Metric icon={Waves} label="水槽" value={record.tank ?? "未登録"} />
          <Metric icon={CircleDollarSign} label="購入総額（税込）" value={formatPrice(totalPrice(record))} />
          {record.deathRecords.length > 0 && <Metric icon={CalendarDays} label="最後の死亡日" value={formatDate(lastDeathDate(record))} />}
        </div>

        {record.deathRecords.length > 0 && <div className="mt-3 border-t border-white/7 pt-3"><h3 className="mb-1.5 text-[10px] font-semibold tracking-wide text-rose-200/80">死亡履歴</h3><div className="space-y-1">{record.deathRecords.map((deathRecord, index) => <div key={`${deathRecord.date}-${index}`} className="rounded-md border border-white/6 bg-black/15 px-2.5 py-1.5 text-[10px]"><div className="flex items-center justify-between gap-2"><span className="text-gray-300">{index + 1}匹目　{formatDate(deathRecord.date)}</span><span className="tabular-nums text-gray-500">生存 {durationBetween(record.acquiredDate, deathRecord.date)}</span></div>{deathRecord.reason && <p className="mt-1 text-gray-500">死亡理由：{deathRecord.reason}</p>}</div>)}</div></div>}

        <div className="mt-3 border-t border-white/7 pt-3">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-wide text-cyan-300/80">飼育メモ（自動要約）</h3>
          <p className="text-[11px] leading-[1.75] text-gray-400">{record.profileSummary}</p>
          {record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-300">出典を確認 <ExternalLink className="h-3 w-3" /></a>}
          {record.taxonomyGroup === "未分類" && <button type="button" onClick={() => onEdit(record)} className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/8 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/14">検索名を指定して再取得 <Pencil className="h-3 w-3" /></button>}
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
  const [purchasedQuantity, setPurchasedQuantity] = useState(record?.quantity ?? 1);
  const [deathRecords, setDeathRecords] = useState(record?.deathRecords ?? []);
  const [deathDateDraft, setDeathDateDraft] = useState("");
  const showWikipediaNameField = record?.taxonomyGroup === "未分類";

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
          <div><h2 id="aquarium-editor-title" className="text-sm font-bold text-white">{record ? "生体記録を編集" : "新しい生体を登録"}</h2><p className="mt-0.5 text-[10px] text-gray-500">種族・科・学名・特徴・ネット写真は生体名から自動取得します。</p></div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-white/5 hover:text-white" aria-label="閉じる"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="生体の名前" required className="sm:col-span-2" hint="この名前で情報を検索します"><input name="name" required defaultValue={record?.name} placeholder="例：ネオンテトラ" className={inputClass} /></Field>
            {showWikipediaNameField && <div className="sm:col-span-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3"><p className="text-[11px] font-semibold text-amber-100">検索名を指定して再取得</p><p className="mt-1 text-[10px] leading-relaxed text-gray-500">店頭名は変えず、日本語Wikipediaと日本語の熱帯魚図鑑で検索する名前を指定して、分類・学名・飼育メモ・写真を自動で取り直します。</p><div className="mt-3"><Field label="検索名" hint="例：ネオンテトラ"><input name="wikipediaName" defaultValue={record?.wikipediaName} placeholder="例：ネオンテトラ" className={inputClass} /></Field></div></div>}
            {!showWikipediaNameField && record?.wikipediaName && <input type="hidden" name="wikipediaName" value={record.wikipediaName} />}
            <Field label="購入日" required><CalendarDatePicker name="acquiredDate" required defaultValue={record?.acquiredDate ?? today()} /></Field>
            <Field label="購入店舗名"><input name="store" defaultValue={record?.store} placeholder="例：アクアショップ○○" className={inputClass} /></Field>
            <Field label="購入数" required><input type="number" min="1" name="quantity" required value={purchasedQuantity} onChange={(event) => { const nextQuantity = Math.max(1, Number.parseInt(event.target.value, 10) || 1); setPurchasedQuantity(nextQuantity); setDeathRecords((current) => current.slice(0, nextQuantity)); }} className={inputClass} /></Field>
            <Field label="購入価格（税込・1匹あたり）" hint="小数は四捨五入"><div className="relative"><input type="number" min="0" step="any" name="unitPrice" defaultValue={record?.unitPrice} placeholder="0" className={`${inputClass} pr-8`} /><span className="absolute right-2.5 top-2.5 text-[10px] text-gray-600">円</span></div></Field>
            <Field label="水槽名"><input name="tank" defaultValue={record?.tank} placeholder="例：リビング60cm水槽" className={inputClass} /></Field>
            <Field label="死亡記録" className="sm:col-span-2" hint={`最大${purchasedQuantity}件まで`}><div className="space-y-2 rounded-lg border border-white/8 bg-black/15 p-3">{deathRecords.length === 0 ? <p className="text-[10px] text-gray-600">死亡記録はありません</p> : <div className="space-y-1.5">{deathRecords.map((deathRecord, index) => <div key={`${deathRecord.date}-${index}`} className="rounded-md border border-white/8 bg-black/15 p-2"><div className="flex items-center justify-between gap-2"><input type="hidden" name="deathDates" value={deathRecord.date} /><span className="text-[11px] text-gray-300">{index + 1}匹目：{formatDate(deathRecord.date)}</span><button type="button" onClick={() => setDeathRecords((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="rounded px-1.5 py-1 text-[10px] text-gray-500 hover:bg-rose-400/10 hover:text-rose-200">削除</button></div><input name="deathReasons" defaultValue={deathRecord.reason} placeholder="死亡理由（任意）" className={`${inputClass} mt-2`} /></div>)}</div>}<div className="flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><CalendarDatePicker name="deathDate" value={deathDateDraft} onChange={setDeathDateDraft} allowClear /></div><button type="button" disabled={!deathDateDraft || deathRecords.length >= purchasedQuantity} onClick={() => { if (!deathDateDraft) return; setDeathRecords((current) => [...current, { date: deathDateDraft }].sort((left, right) => left.date.localeCompare(right.date))); setDeathDateDraft(""); }} className="h-9 shrink-0 rounded-md border border-rose-300/25 bg-rose-300/8 px-3 text-[11px] font-semibold text-rose-100 hover:bg-rose-300/14 disabled:cursor-not-allowed disabled:opacity-40">死亡日を追加</button></div></div></Field>
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
        <thead className="border-b border-white/8 bg-white/[0.035] text-[10px] font-semibold text-gray-500"><tr><th className="px-3 py-2.5">生体</th><th className="px-3 py-2.5">最大サイズ</th><th className="px-3 py-2.5">購入日</th><th className="px-3 py-2.5">購入店舗</th><th className="px-3 py-2.5 text-right">1匹あたり（税込）</th><th className="px-3 py-2.5 text-center">購入数</th><th className="px-3 py-2.5 text-right">購入総額（税込）</th><th className="px-3 py-2.5">水槽</th><th className="px-3 py-2.5">生存情報</th><th className="px-3 py-2.5">期間</th><th className="w-20 px-3 py-2.5"></th></tr></thead>
        <tbody className="divide-y divide-white/[0.055]">{records.map((record) => <tr key={record.id} className="text-gray-300 hover:bg-white/[0.025]">
          <td className="px-3 py-2.5"><div className="font-semibold text-white">{record.name}</div><div className="text-[10px] text-cyan-600">{organismType(record)}・{record.taxonomyGroup}{record.familyName ? `・${record.familyName}` : ""}</div>{record.scientificName && <div className="text-[10px] italic text-gray-600">{record.scientificName}</div>}</td><td className="whitespace-nowrap px-3 py-2.5 text-cyan-100/80">{record.maxSize ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(record.acquiredDate)}</td><td className="max-w-40 truncate px-3 py-2.5">{record.store ?? "—"}</td><td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatPrice(record.unitPrice)}</td><td className="px-3 py-2.5 text-center tabular-nums">{record.quantity}</td><td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatPrice(totalPrice(record))}</td><td className="max-w-36 truncate px-3 py-2.5">{record.tank ?? "—"}</td>
          <td className="px-3 py-2.5">{livingCount(record) > 0 ? <div><span className="text-emerald-300">飼育中 {livingCount(record)}/{record.quantity}匹</span>{record.deathRecords.length > 0 && <div className="mt-0.5 text-[10px] tabular-nums text-gray-600">死亡 {record.deathRecords.map((deathRecord) => formatDate(deathRecord.date)).join(" / ")}</div>}</div> : <div><span className="text-gray-400">全個体死亡</span><div className="text-[10px] tabular-nums text-gray-600">{record.deathRecords.map((deathRecord) => formatDate(deathRecord.date)).join(" / ")}</div></div>}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-cyan-200">{durationLabel(record)}</td>
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
  const [type, setType] = useState("all");
  const [group, setGroup] = useState("all");
  const [tank, setTank] = useState("all");
  const [survival, setSurvival] = useState("all");
  const [editor, setEditor] = useState<AquariumRecord | "new" | undefined>();

  const groups = useMemo(() => [...new Set(records.map((record) => record.taxonomyGroup))].sort((a, b) => a.localeCompare(b, "ja")), [records]);
  const tanks = useMemo(() => [...new Set(records.map((record) => record.tank).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "ja")), [records]);
  const hasUnassignedTank = records.some((record) => !record.tank);
  const filtered = useMemo(() => records.filter((record) => {
    const haystack = [record.name, record.taxonomyGroup, record.familyName, record.scientificName, record.maxSize, record.store, record.tank, record.notes, record.profileSummary].filter(Boolean).join(" ").toLocaleLowerCase("ja");
    const tankMatches = tank === "all" || (tank === "unassigned" ? !record.tank : record.tank === tank);
    return (type === "all" || organismType(record) === type) && (group === "all" || record.taxonomyGroup === group) && tankMatches && (survival !== "alive" || livingCount(record) > 0) && (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase("ja")));
  }), [group, query, records, survival, tank, type]);

  const aliveQuantity = records.reduce((sum, record) => sum + livingCount(record), 0);
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

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric icon={Fish} label="登録記録" value={`${records.length}件`} /><Metric icon={HeartPulse} label="飼育中の匹数" value={`${aliveQuantity}匹`} /><Metric icon={Waves} label="自動分類された種族" value={`${groups.length}種族`} /><Metric icon={CircleDollarSign} label="購入金額合計（税込）" value={formatPrice(totalSpent)} /></section>

    <DataViewToolbar mode={view} onModeChange={setView} count={filtered.length}><div className="relative min-w-[180px] flex-1 sm:w-64 sm:flex-none"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="生体・科・水槽を検索" aria-label="記録を検索" className="h-7 w-full rounded-md border border-white/10 bg-black/20 pl-8 pr-2 text-[11px] outline-none placeholder:text-gray-700 focus:border-cyan-400/40" /></div></DataViewToolbar>

    <section aria-label="記録を絞り込む" className="glass-card flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg px-3 py-2.5">
      <FilterTagGroup label="種類" selected={type} onSelect={setType} options={[{ value: "熱帯魚", label: "熱帯魚" }, { value: "水草", label: "水草" }]} />
      <FilterTagGroup label="生存" allLabel="すべて" selected={survival} onSelect={setSurvival} options={[{ value: "alive", label: "飼育中のみ" }]} />
      <FilterTagGroup label="水槽" selected={tank} onSelect={setTank} options={[...tanks.map((value) => ({ value, label: value })), ...(hasUnassignedTank ? [{ value: "unassigned", label: "未登録" }] : [])]} />
      <FilterTagGroup label="種族" selected={group} onSelect={setGroup} options={groups.map((value) => ({ value, label: value }))} />
    </section>

    {error && <div className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-xs text-rose-200">{error}</div>}
    {filtered.length === 0 ? <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/8 text-cyan-300"><Fish className="h-7 w-7" /></div><h2 className="mt-4 text-sm font-bold text-gray-200">{records.length === 0 ? "最初の生体を登録しましょう" : "条件に合う記録がありません"}</h2><p className="mt-1.5 text-[11px] text-gray-600">{records.length === 0 ? "名前を入力すれば、種族や特徴を自動で調べます。" : "検索や絞り込み条件を変えてください。"}</p>{records.length === 0 && <button type="button" onClick={() => setEditor("new")} className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 bg-cyan-400/8 px-3 py-2 text-[11px] font-semibold text-cyan-200"><Plus className="h-3.5 w-3.5" />記録を追加</button>}</section> : view === "cards" ? <div className="responsive-card-grid">{filtered.map((record) => <AquariumCard key={record.id} record={record} onEdit={setEditor} onDelete={(item) => void remove(item)} />)}</div> : <AquariumTable records={filtered} onEdit={setEditor} onDelete={(item) => void remove(item)} />}
    {editor && <RecordEditor key={editor === "new" ? "new" : editor.id} record={editor === "new" ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={saved} />}
  </div>;
}
