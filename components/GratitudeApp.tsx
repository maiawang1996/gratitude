"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock,
  Heart,
  Inbox,
  Lock,
  Send,
  Settings2
} from "lucide-react";
import {
  defaultDeliveryTime,
  directorySections,
  entries,
  featureRows,
  formatDeliveryTime,
  getKindLabel,
  type DeliveryMode,
  type EntryKind,
  type Sender
} from "@/lib/gratitude-data";

export function GratitudeApp() {
  const [kind, setKind] = useState<EntryKind>("thank-you");
  const [sender, setSender] = useState<Sender | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [note, setNote] = useState("");
  const [deliveryTime, setDeliveryTime] = useState(defaultDeliveryTime);
  const todayEntry = entries[0] ?? null;
  const updateDeliveryTime = (value: string) => {
    if (value) setDeliveryTime(value);
  };

  const remaining = Math.max(0, 220 - note.length);
  const readableDeliveryTime = formatDeliveryTime(deliveryTime);
  const canSave = note.trim().length >= 18 && sender !== null && deliveryMode !== null;
  const deliverySummary =
    deliveryMode === "now"
      ? "立即送达"
      : deliveryMode === "scheduled"
        ? readableDeliveryTime
        : "选择送达方式";
  const emptyDeliveryText =
    deliveryMode === "now"
      ? "新的内容会在立即送达后出现在这里。"
      : `新的内容会在 ${readableDeliveryTime} 后出现在这里。`;
  const draftLabel = useMemo(() => {
    if (note.trim().length === 0) return "草稿为空";
    if (note.trim().length < 18) return "还可以再写一点";
    if (sender === null) return "请选择来自谁";
    if (deliveryMode === null) return "请选择送达方式";
    return deliveryMode === "now" ? "可以立即送达" : "今晚可以送达";
  }, [deliveryMode, note, sender]);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:gap-7 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f2dfb8] shadow-sm">
              <Heart className="h-5 w-5 fill-clay stroke-clay" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-moss">只属于两个人</p>
              <h1 className="text-3xl font-semibold tracking-normal">Gratitude</h1>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e6dccd] bg-white/70 px-2.5 py-1.5 text-xs text-[#6d645b] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
            <Lock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">宝贝+老公</span>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-2 rounded-[8px] border border-[#eadfce] bg-white/72 p-2 shadow-sm">
          {featureRows.map((item) => (
            <div key={item.label} className="min-w-0 rounded-[7px] bg-[#fffdf9] px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5 shrink-0 text-clay" aria-hidden="true" />
                <p className="truncate text-[11px] font-medium text-[#8f8172]">
                {item.label}
                </p>
              </div>
              <p className="truncate text-xs font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-[8px] border border-[#e6dccd] bg-white p-5 shadow-quiet sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-moss">今天写一句</p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight">今晚送达的一句话</h2>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-mist px-3 py-2 text-sm text-moss">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {deliverySummary}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 rounded-[8px] bg-[#f5efe6] p-1">
                <button
                  type="button"
                  onClick={() => setKind("thank-you")}
                  className={`rounded-[7px] px-3 py-3 text-sm font-medium transition ${
                    kind === "thank-you" ? "bg-white text-ink shadow-sm" : "text-[#756a5f]"
                  }`}
                >
                  谢谢你 ❤️
                </button>
                <button
                  type="button"
                  onClick={() => setKind("noticed")}
                  className={`rounded-[7px] px-3 py-3 text-sm font-medium transition ${
                    kind === "noticed" ? "bg-white text-ink shadow-sm" : "text-[#756a5f]"
                  }`}
                >
                  我看见了 👀
                </button>
              </div>

              <label className="mt-5 block">
                <span className="sr-only">Today note</span>
                <textarea
                  value={note}
                  maxLength={220}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={kind === "thank-you" ? "谢谢你..." : "我看见你..."}
                  className="min-h-40 w-full resize-none rounded-[8px] border border-[#e3d8c8] bg-[#fffdf9] p-4 text-lg leading-8 outline-none transition placeholder:text-[#b8aa9a] focus:border-honey focus:ring-4 focus:ring-[#f1d29d]/30"
                />
              </label>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[#756a5f]">来自</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSender("baby")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      sender === "baby"
                        ? "border-[#e8c987] bg-[#fff5df] text-ink shadow-sm"
                        : "border-[#eadfce] bg-[#fffdf9] text-[#756a5f]"
                    }`}
                  >
                    <span aria-hidden="true">👸</span>
                    宝贝
                  </button>
                  <button
                    type="button"
                    onClick={() => setSender("husband")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      sender === "husband"
                        ? "border-[#d7b6a8] bg-[#fff0ea] text-ink shadow-sm"
                        : "border-[#eadfce] bg-[#fffdf9] text-[#756a5f]"
                    }`}
                  >
                    <span aria-hidden="true">🧸</span>
                    老公
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[#756a5f]">送达</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("now")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      deliveryMode === "now"
                        ? "border-[#e8c987] bg-[#fff5df] text-ink shadow-sm"
                        : "border-[#eadfce] bg-[#fffdf9] text-[#756a5f]"
                    }`}
                  >
                    <span aria-hidden="true">⚡</span>
                    立即送达
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("scheduled")}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      deliveryMode === "scheduled"
                        ? "border-[#d7b6a8] bg-[#fff0ea] text-ink shadow-sm"
                        : "border-[#eadfce] bg-[#fffdf9] text-[#756a5f]"
                    }`}
                  >
                    <span aria-hidden="true">🌙</span>
                    定时送达
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{draftLabel}</p>
                  <p className="text-xs text-[#8a7d70]">还可以写 {remaining} 个字</p>
                </div>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#443f38] disabled:cursor-not-allowed disabled:bg-[#c8beb1] sm:w-auto sm:px-5"
                  disabled={!canSave}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {deliveryMode === "now"
                    ? "立即送达"
                    : deliveryMode === "scheduled"
                      ? "存到今晚"
                      : "选择送达方式"}
                </button>
              </div>
            </section>

            <section className="rounded-[8px] border border-[#e6dccd] bg-white p-5 shadow-quiet sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-moss">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                送达时间
              </div>
              <label className="block">
                <span className="text-xl font-semibold">每天送达于</span>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(event) => updateDeliveryTime(event.currentTarget.value)}
                  onInput={(event) => updateDeliveryTime(event.currentTarget.value)}
                  className="mt-4 h-12 w-full rounded-[8px] border border-[#e3d8c8] bg-[#fffdf9] px-4 text-lg font-semibold text-ink outline-none focus:border-honey focus:ring-4 focus:ring-[#f1d29d]/30 sm:max-w-56"
                />
              </label>
              <p className="mt-3 text-sm leading-6 text-[#756a5f]">
                选择定时送达时，内容会安静保存，到 {readableDeliveryTime} 再送达。
              </p>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[8px] border border-[#e6dccd] bg-white p-5 shadow-quiet">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-moss">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                今天收到
              </div>
              {todayEntry ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">From {todayEntry.from}</h2>
                    <span className="rounded-full bg-[#f6dfd8] px-3 py-1 text-xs font-semibold text-clay">
                      {getKindLabel(todayEntry.kind)}
                    </span>
                  </div>
                  <p className="text-lg leading-8">{todayEntry.body}</p>
                </>
              ) : (
                <EmptyState
                  title="还没有收到内容"
                  body={emptyDeliveryText}
                />
              )}
            </section>

            <section className="rounded-[8px] border border-[#e6dccd] bg-white p-5 shadow-quiet">
              <p className="text-sm font-medium text-moss">目录</p>
              <h2 className="mt-1 text-2xl font-semibold">以后慢慢看</h2>
              <div className="mt-5 space-y-3">
                {directorySections.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex w-full items-center justify-between rounded-[8px] border border-[#eadfce] bg-[#fffdf9] p-4 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{item.label}</span>
                        <span className="block text-sm leading-5 text-[#85796d]">{item.detail}</span>
                      </span>
                    </span>
                    <span className="ml-3 inline-flex shrink-0 items-center gap-2 text-sm text-[#85796d]">
                      {item.value}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#dccfbd] bg-[#fffdf9] p-5">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#756a5f]">{body}</p>
    </div>
  );
}
