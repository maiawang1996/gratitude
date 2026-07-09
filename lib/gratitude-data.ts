import {
  CalendarDays,
  Heart,
  Library,
  Moon,
  NotebookTabs
} from "lucide-react";

export type EntryKind = "thank-you" | "noticed";
export type ReactionState = "new" | "seen" | "loved";
export type Sender = "baby" | "husband";
export type DeliveryMode = "now" | "scheduled";

export type GratitudeEntry = {
  id: string;
  kind: EntryKind;
  from: "Maia" | "Husband";
  to: "Maia" | "Husband";
  body: string;
  writtenAt: string;
  deliveredAt: string;
  state: ReactionState;
};

export type Review = {
  title: string;
  period: string;
  body: string;
  highlights: string[];
};

export const defaultDeliveryTime = "21:00";

export const entries: GratitudeEntry[] = [];

export const weeklyReview: Review | null = null;

export const monthlyReflection: Review | null = null;

export const featureRows = [
  { label: "两个人", value: "宝贝 + 老公", icon: Heart },
  { label: "送达", value: "可编辑", icon: Moon },
  { label: "回忆", value: "永久保存", icon: Library }
];

export const directorySections = [
  { label: "回忆库", value: "暂无", detail: "按年份和月份浏览", icon: Library },
  { label: "周回顾", value: "暂无", detail: "Monday-Sunday", icon: CalendarDays },
  { label: "月总结", value: "暂无", detail: "有真实内容后生成", icon: NotebookTabs }
];

export function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function getKindLabel(kind: EntryKind) {
  return kind === "thank-you" ? "Thank You" : "I Noticed";
}

export function formatDeliveryTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
