"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Library,
  LogIn,
  LogOut,
  PenLine,
  Sparkles,
  SunMedium,
  UserRound
} from "lucide-react";
import {
  defaultDeliveryTime,
  entries,
  featureRows,
  formatEntryDate,
  formatDeliveryTime,
  getKindLabel,
  type DeliveryMode,
  type EntryKind,
  type GratitudeEntry,
  type Sender
} from "@/lib/gratitude-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const LAST_EMAIL_KEY = "gratitude-last-email";
const TRUST_DEVICE_KEY = "gratitude-trust-device";
const DAILY_REMINDER_KEY = "gratitude-daily-reminder";
const ROLE_BABY = "baby";
const ROLE_HUSBAND = "husband";
const LOVE_START_DATE = "2017-09-12";
const MARRIAGE_START_DATE = "2023-05-22";
const BABY_BIRTHDAY = { month: 12, day: 16, label: "宝贝" };
const HUSBAND_BIRTHDAY = { month: 8, day: 25, label: "老公" };
const UPCOMING_REMINDER_WINDOW_DAYS = 30;
const hourOptions = Array.from({ length: 16 }, (_, index) => String(index + 8).padStart(2, "0"));
const minuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const babyEmail = process.env.NEXT_PUBLIC_BABY_EMAIL?.trim().toLowerCase() ?? "";
const husbandEmail = process.env.NEXT_PUBLIC_HUSBAND_EMAIL?.trim().toLowerCase() ?? "";
const coupleIdFallback = process.env.NEXT_PUBLIC_COUPLE_ID?.trim() ?? "";
const babyUserId = process.env.NEXT_PUBLIC_BABY_USER_ID?.trim() ?? "9ca45174-47f8-4e1f-ad54-7418611b0db6";
const husbandUserId = process.env.NEXT_PUBLIC_HUSBAND_USER_ID?.trim() ?? "b934c1ee-15b6-4fd3-80a5-34da573dba55";

type CoupleMemberRow = {
  id: string;
  couple_id: string;
  user_id: string;
  display_name: string;
};

type GratitudeEntryRow = {
  id: string;
  couple_id: string;
  author_id: string;
  recipient_id: string;
  kind: EntryKind;
  body: string;
  local_entry_date: string;
  deliver_at: string;
  delivered_at: string | null;
  recipient_reaction: "none" | "seen" | "loved";
  recipient_seen_at: string | null;
  recipient_loved_at: string | null;
  created_at: string;
};

export function GratitudeApp() {
  const [tab, setTab] = useState<"home" | "memory" | "me">("home");
  const [historyTab, setHistoryTab] = useState<"sent" | "received">("received");
  const [mood, setMood] = useState<"celebrating" | "soft" | "blank" | "tired" | null>(null);
  const [moodOverlay, setMoodOverlay] = useState<"celebrating" | "soft" | "blank" | "tired" | null>(null);
  const [kind, setKind] = useState<EntryKind>("thank_you");
  const [sender, setSender] = useState<Sender | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [note, setNote] = useState("");
  const [historyEntries, setHistoryEntries] = useState<GratitudeEntry[]>(entries);
  const [deliveryTime, setDeliveryTime] = useState(defaultDeliveryTime);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentMemberName, setCurrentMemberName] = useState("");
  const [partnerMemberName, setPartnerMemberName] = useState("");
  const [partnerUserId, setPartnerUserId] = useState("");
  const [coupleId, setCoupleId] = useState(coupleIdFallback);
  const [dataLoading, setDataLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<GratitudeEntry | null>(null);
  const [sendSuccessVisible, setSendSuccessVisible] = useState(false);
  const [sendSuccessMode, setSendSuccessMode] = useState<DeliveryMode>("now");
  const [todayFeedbackPulse, setTodayFeedbackPulse] = useState<"seen" | "loved" | null>(null);
  const [todayFeedbackOverlay, setTodayFeedbackOverlay] = useState<"seen" | "loved" | null>(null);
  const [pushStatus, setPushStatus] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [dailyReminderVisible, setDailyReminderVisible] = useState(false);
  const [featureRowsExpanded, setFeatureRowsExpanded] = useState(false);
  const [birthdayPanelExpanded, setBirthdayPanelExpanded] = useState(false);
  const [reviewMonthOffset, setReviewMonthOffset] = useState(0);

  const readableDeliveryTime = formatDeliveryTime(deliveryTime);
  const currentRole = resolveRole(currentUserEmail);
  const currentRoleLabel = currentRole === ROLE_BABY ? "宝贝" : currentRole === ROLE_HUSBAND ? "老公" : "";
  const myName = currentMemberName || (currentRole === ROLE_BABY ? "Maia" : currentRole === ROLE_HUSBAND ? "Husband" : "");
  const visibleHistoryEntries = historyEntries.filter((item) => {
    if (item.from === myName) return true;
    return isDeliveredForViewer(item);
  });
  const sentEntries = visibleHistoryEntries.filter((item) => item.from === myName);
  const receivedEntries = visibleHistoryEntries.filter((item) => item.to === myName);
  const saveLabel = "发送爱意";
  const pendingReceivedEntries = receivedEntries.filter((item) => item.state === "new");
  const todayFeedbackEntry = pendingReceivedEntries[0] ?? null;
  const loveDuration = formatRelationshipDuration(LOVE_START_DATE);
  const marriageDuration = formatRelationshipDuration(MARRIAGE_START_DATE);
  const upcomingReminder = getUpcomingReminder(new Date());
  const reviewMonthDate = new Date();
  reviewMonthDate.setMonth(reviewMonthDate.getMonth() + reviewMonthOffset);
  const monthlyReview = buildMonthlyReview({
    sentEntries,
    receivedEntries,
    reviewMonth: reviewMonthDate,
    currentDate: new Date()
  });
  const overallStats = buildOverallStats(historyEntries);
  const moodItems = [
    { key: "celebrating" as const, emoji: "🥳", caption: "哇！今天是心情超好的一天", overlayTitle: "今天亮晶晶的", overlayBody: "把开心轻轻放在这里了" },
    { key: "soft" as const, emoji: "😊", caption: "嘿嘿，今天心情不错哦～", overlayTitle: "今天很温柔", overlayBody: "这一刻被安安静静地记住了" },
    { key: "blank" as const, emoji: "🫥", caption: "嗯…今天有一点放空…", overlayTitle: "今天想慢一点", overlayBody: "就这样发会儿呆也没关系" },
    { key: "tired" as const, emoji: "😣", caption: "今天有点累了，要多休息照顾自己呀", overlayTitle: "今天辛苦了", overlayBody: "先抱一抱自己，再慢慢往前走" }
  ];

  const triggerTodayFeedback = async (reaction: "seen" | "loved") => {
    if (!todayFeedbackEntry) return;
    setTodayFeedbackPulse(reaction);
    setTodayFeedbackOverlay(reaction);
    await handleReactEntry(todayFeedbackEntry.id, reaction);
    window.setTimeout(() => setTodayFeedbackPulse(null), 420);
    window.setTimeout(() => setTodayFeedbackOverlay(null), 1100);
  };

  const handleSave = async () => {
    setSaveStatus("已点击保存");
    setAuthError(null);
    if (!currentUserEmail) {
      setSaveStatus("请先登录");
      setAuthError("请先登录。");
      return;
    }
    if (note.trim().length === 0) {
      setSaveStatus("没有内容");
      setAuthError("先写一点内容再保存。");
      return;
    }
    if (sender === null) {
      setSaveStatus("还没选来自");
      setAuthError("请选择来自宝贝还是老公。");
      return;
    }
    if (deliveryMode === null) {
      setSaveStatus("还没选送达方式");
      setAuthError("请选择立即送达还是定时送达。");
      return;
    }
    const userRole = resolveRole(currentUserEmail);
    if (!userRole) {
      setAuthError("请先用宝贝或老公的账号登录。");
      return;
    }
    if (sender !== userRole) {
      setAuthError("当前登录身份和“来自”不一致。");
      return;
    }
    const createdAt = new Date();

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;
      const sessionUserId = sessionUser?.id ?? currentUserId;
      const sessionEmail = sessionUser?.email?.toLowerCase() ?? currentUserEmail;
      const currentRoleLabel = resolveRole(sessionEmail) === ROLE_BABY ? "Maia" : "Husband";
      const partnerRoleLabel = currentRoleLabel === "Maia" ? "Husband" : "Maia";
      const currentUserIdFixed = currentRoleLabel === "Maia" ? babyUserId : husbandUserId;
      const partnerUserId = currentRoleLabel === "Maia" ? husbandUserId : babyUserId;

      let activeCurrentUserId = currentUserIdFixed || sessionUserId;
      let activeCoupleId = coupleIdFallback || coupleId;

      if (!activeCoupleId) {
        setSaveStatus("没找到情侣关系");
        return;
      }

      const scheduledDeliverAt =
        deliveryMode === "scheduled" ? buildScheduledDeliverAt(createdAt, deliveryTime) : null;

      if (deliveryMode === "scheduled" && !scheduledDeliverAt) {
        setSaveStatus("定时已过");
        setAuthError("请选择今天稍后的送达时间。");
        return;
      }

      const payload = {
        couple_id: activeCoupleId,
        author_id: activeCurrentUserId,
        recipient_id: partnerUserId,
        kind,
        body: note.trim(),
        local_entry_date: formatLocalEntryDate(createdAt),
        deliver_at: deliveryMode === "now" ? createdAt.toISOString() : scheduledDeliverAt,
        delivered_at: deliveryMode === "now" ? createdAt.toISOString() : null
      };

      const { data, error } = await supabase
        .from("gratitude_entries")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        setSaveStatus("写入失败");
        setAuthError(error.message);
        return;
      }

      const savedEntry = mapEntryRowToUi(
        data as GratitudeEntryRow,
        activeCurrentUserId,
        currentRoleLabel,
        partnerRoleLabel
      );
      setHistoryEntries((current) => [savedEntry, ...current]);
      if (deliveryMode === "now") {
        void fetch("/api/push/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientId: partnerUserId,
            title: kind === "thank_you" ? "收到一条谢谢你" : "收到一条我看见了",
            message: note.trim(),
            url: "/"
          })
        });
      }
      setNote("");
      setDeliveryMode(null);
      setAuthError(null);
      setSaveStatus("");
      setSendSuccessMode(deliveryMode);
      setSendSuccessVisible(true);
      window.setTimeout(() => {
        setSendSuccessVisible(false);
      }, 1600);
    } catch (error) {
      setSaveStatus("异常");
      setAuthError(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleDeleteEntry = async (entry: GratitudeEntry) => {
    if (isPendingScheduledEntry(entry)) {
      const confirmed = window.confirm("该消息还未送达，确认删除吗？");
      if (!confirmed) return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("gratitude_entries").delete().eq("id", entry.id);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setHistoryEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleReactEntry = async (entryId: string, reaction: "seen" | "loved") => {
    try {
      const supabase = getSupabaseBrowserClient();
      const now = new Date().toISOString();
      const reactedEntry = historyEntries.find((item) => item.id === entryId) ?? null;
      const patch =
        reaction === "seen"
          ? { recipient_reaction: "seen", recipient_seen_at: now, recipient_loved_at: null }
          : { recipient_reaction: "loved", recipient_seen_at: now, recipient_loved_at: now };
      const { error } = await supabase.from("gratitude_entries").update(patch).eq("id", entryId);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setHistoryEntries((current) =>
        current.map((item) =>
          item.id === entryId ? { ...item, state: reaction === "seen" ? "seen" : "loved" } : item
        )
      );
      if (reactedEntry?.authorUserId && reactedEntry.authorUserId !== currentUserId) {
        void fetch("/api/push/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientId: reactedEntry.authorUserId,
            title: reaction === "seen" ? "对方已读了你的消息" : "对方喜欢了你的消息",
            message: reactedEntry.body,
            url: "/"
          })
        });
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "更新失败");
    }
  };

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const sessionEmail = data.session?.user.email?.toLowerCase() ?? "";
        setCurrentUserEmail(sessionEmail);
        setCurrentUserId(data.session?.user.id ?? "");
        setAuthLoading(false);

        const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextEmail = session?.user.email?.toLowerCase() ?? "";
          setCurrentUserEmail(nextEmail);
          setCurrentUserId(session?.user.id ?? "");
          setAuthLoading(false);
        });

        return () => {
          subscriptionData.subscription.unsubscribe();
        };
      } catch (error) {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : "Supabase 初始化失败");
        setAuthLoading(false);
      }
    };

    let cleanup: (() => void) | undefined;
    void initAuth().then((result) => {
      cleanup = result ?? undefined;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TRUST_DEVICE_KEY);
      if (stored !== null) {
        setTrustThisDevice(stored === "true");
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    if (!currentUserEmail) return;
    const today = formatLocalEntryDate(new Date());
    const hour = new Date().getHours();
    if (hour < 20) return;
    if (historyEntries.some((item) => item.writtenAt.slice(0, 10) === today)) return;
    try {
      const remembered = window.localStorage.getItem(DAILY_REMINDER_KEY);
      if (remembered === today) return;
      window.localStorage.setItem(DAILY_REMINDER_KEY, today);
    } catch {
      // Ignore storage errors.
    }
    setDailyReminderVisible(true);
  }, [currentUserEmail, historyEntries]);

  useEffect(() => {
    if (!currentUserId) return;

    const loadData = async () => {
      setDataLoading(true);
      setAuthError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const currentRoleLabelFallback = resolveRole(currentUserEmail) === ROLE_BABY ? "Maia" : resolveRole(currentUserEmail) === ROLE_HUSBAND ? "Husband" : "";
        const currentMemberNameFallback = currentRoleLabelFallback || "Maia";
        const partnerMemberNameFallback = currentMemberNameFallback === "Maia" ? "Husband" : "Maia";

        setCoupleId(coupleIdFallback);
        setCurrentMemberName(currentMemberNameFallback);
        setPartnerMemberName(partnerMemberNameFallback);
        setPartnerUserId(currentMemberNameFallback === "Maia" ? husbandUserId : babyUserId);

        const { data: entryRows, error: entryError } = await supabase
          .from("gratitude_entries")
          .select("*")
          .eq("couple_id", coupleIdFallback || coupleId)
          .order("created_at", { ascending: false });

        if (entryError) {
          setAuthError(entryError.message);
          return;
        }

        const mapped = (entryRows as GratitudeEntryRow[] | null | undefined)?.map((row) =>
          mapEntryRowToUi(
            row,
            currentUserId,
            currentMemberNameFallback,
            partnerMemberNameFallback
          )
        ) ?? [];
        setHistoryEntries(mapped);
      } finally {
        setDataLoading(false);
      }
    };

    void loadData();
  }, [currentUserId, currentUserEmail]);

  const handleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setCurrentUserEmail(data.user?.email?.toLowerCase() ?? authEmail.trim().toLowerCase());
      setSender(resolveRole(data.user?.email?.toLowerCase() ?? authEmail.trim().toLowerCase()));
      try {
        const nextEmail = data.user?.email?.toLowerCase() ?? authEmail.trim().toLowerCase();
        if (trustThisDevice) {
          window.localStorage.setItem(LAST_EMAIL_KEY, nextEmail);
        } else {
          window.localStorage.removeItem(LAST_EMAIL_KEY);
        }
      } catch {
        // Ignore storage write errors.
      }
      setAuthPassword("");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setCurrentUserEmail("");
    setCurrentUserId("");
    setSender(null);
    setHistoryEntries(entries);
    setCoupleId("");
    setPartnerUserId("");
    setCurrentMemberName("");
    setPartnerMemberName("");
  };

  const handleEnablePush = async () => {
    try {
      setPushStatus("");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushStatus("当前浏览器不支持提醒。");
        return;
      }

      const isLocalhost =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalhost) {
        setPushStatus("本地开发环境暂时不启用提醒。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("你还没有允许提醒。");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setPushStatus("还没有配置推送公钥。");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setPushStatus("请先登录。");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          subscription: subscription.toJSON()
        })
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPushStatus(result.error ?? "订阅失败");
        setPushEnabled(false);
        return;
      }

      setPushEnabled(true);
      setPushStatus("提醒已开启。");
    } catch (error) {
      setPushEnabled(false);
      setPushStatus(error instanceof Error ? error.message : "开启提醒失败");
    }
  };

  useEffect(() => {
    const role = resolveRole(currentUserEmail);
    if (role) setSender(role);
  }, [currentUserEmail]);

  useEffect(() => {
    if (authEmail) return;
    try {
      const storedEmail = window.localStorage.getItem(LAST_EMAIL_KEY)?.trim().toLowerCase() ?? "";
      if (storedEmail) {
        setAuthEmail(storedEmail);
        setSender(resolveRole(storedEmail));
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [authEmail]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentUserEmail) {
      setPushEnabled(false);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushEnabled(false);
      return;
    }

    let active = true;

    const syncPushState = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = registration ? await registration.pushManager.getSubscription() : null;
        if (!active) return;
        setPushEnabled(Boolean(subscription));
      } catch {
        if (!active) return;
        setPushEnabled(false);
      }
    };

    void syncPushState();

    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  const memoryEntries = historyEntries;

  if (authLoading) {
    return (
      <main className="warm-shell min-h-screen bg-paper text-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center px-4">
          <div className="glass-panel w-full rounded-[28px] p-5 text-center text-sm text-[#8f7568]">
            <div className="mx-auto mb-3 h-12 w-12 animate-pulse rounded-full bg-[#fff0e4]" />
            正在打开 Gratitude...
          </div>
        </div>
      </main>
    );
  }

  if (!currentUserEmail) {
    return (
      <main className="warm-shell min-h-screen bg-paper text-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-6">
          <section className="glass-panel w-full rounded-[28px] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#fff4ea]">
                <LogIn className="h-6 w-6 text-[#f39a78]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-[1.7rem] font-semibold leading-none text-ink">登录</h1>
                <p className="mt-1 text-sm text-[#8f7568]">用宝贝或老公的账号进入。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#6f5c52]">邮箱</span>
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  className="w-full rounded-[18px] border border-[#ead8c9] bg-[#fffdf9] px-4 py-3 text-base outline-none focus:border-[#f2a36f] focus:ring-4 focus:ring-[#f2a36f]/15"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#6f5c52]">密码</span>
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-[18px] border border-[#ead8c9] bg-[#fffdf9] px-4 py-3 text-base outline-none focus:border-[#f2a36f] focus:ring-4 focus:ring-[#f2a36f]/15"
                />
              </label>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-[22px] bg-[#fff7ef] p-4">
              <input
                checked={trustThisDevice}
                onChange={(event) => {
                  const next = event.target.checked;
                  setTrustThisDevice(next);
                  try {
                    window.localStorage.setItem(TRUST_DEVICE_KEY, String(next));
                  } catch {
                    // Ignore storage errors.
                  }
                }}
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[#d8c3b2] text-[#f39a78] focus:ring-[#f39a78]"
              />
              <span className="text-sm leading-6 text-[#6f5c52]">
                这台是我的设备，保持登录状态，减少下次打开时的等待。
              </span>
            </label>

            {authError ? <p className="mt-3 text-sm text-[#c45f47]">{authError}</p> : null}

            {!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
              <p className="mt-3 text-xs leading-6 text-[#8f7568]">
                现在缺少 Supabase 配置，登录不会真正连上数据库。先把 `.env.local` 配好再登录。
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleLogin}
              disabled={!authEmail || !authPassword}
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#f4a06f] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_28px_rgba(244,160,111,0.28)] transition hover:bg-[#ef955f] disabled:cursor-not-allowed disabled:bg-[#e8c4ac] disabled:shadow-none"
            >
              登录
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="warm-shell min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pb-36 pt-4">
        {dataLoading ? (
          <div className="mb-4 rounded-[24px] bg-[#fff6ee] px-4 py-3 text-sm text-[#8f7568]">
            正在同步历史记录...
          </div>
        ) : null}
        {tab === "home" ? (
          <>
            <section className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setFeatureRowsExpanded((current) => !current)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <div className="mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-[22px] bg-[#fff6ee] shadow-[0_10px_22px_rgba(184,113,93,0.12)]">
                    <Heart className="h-7 w-7 fill-[#f39a78] stroke-[#f39a78]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-[2rem] font-semibold leading-none tracking-[0.01em]">Gratitude</h1>
                      <span className="pt-0.5 text-sm text-[#8f7568]">{featureRowsExpanded ? "▴" : "▾"}</span>
                    </div>
                    <p className="mt-1 text-[0.92rem] text-[#8f7568]">
                      只属于你和我 <span className="text-[#f39a78]">❤</span>
                    </p>
                  </div>
                </button>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setBirthdayPanelExpanded((current) => !current)}
                    className="rounded-full bg-white/70 px-2 py-1 shadow-sm"
                  >
                    <AvatarStack />
                  </button>
                  {birthdayPanelExpanded ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-max max-w-[220px] rounded-[22px] border border-[#eadfce] bg-[#fffdf9]/98 p-3 shadow-[0_18px_36px_rgba(121,90,68,0.16)] backdrop-blur-xl">
                      <p className="text-[0.78rem] font-medium text-[#8f7568]">生日</p>
                      <div className="mt-2 space-y-2 text-sm text-ink">
                        <div className="rounded-[16px] bg-[#fff6ee] px-3 py-2 leading-none whitespace-nowrap">👸 宝贝 · 12 月 16 日</div>
                        <div className="rounded-[16px] bg-[#fff6ee] px-3 py-2 leading-none whitespace-nowrap">🧸 老公 · 8 月 25 日</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {featureRowsExpanded ? (
                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {featureRows.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[22px] border border-white/75 bg-white/50 px-2 py-2 shadow-[0_10px_18px_rgba(184,113,93,0.06)]"
                    >
                      <div className="flex flex-col items-center text-center">
                        <item.icon className="mb-1.5 h-5 w-5 text-[#f1a06f]" aria-hidden="true" />
                        <p className="text-[0.7rem] font-medium text-[#6f5c52]">{item.label}</p>
                        <p className="mt-0.5 text-[0.74rem] font-semibold leading-tight text-ink">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 rounded-[22px] border border-[#eadfce] bg-white/58 px-3 py-3 shadow-[0_8px_18px_rgba(184,113,93,0.06)] backdrop-blur-xl">
                <p className="text-[0.84rem] font-medium text-[#8f7568]">今天心情怎么样？</p>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {moodItems.map((item) => (
                    <div key={item.key} className="flex flex-col items-center text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMood(item.key);
                          setMoodOverlay(item.key);
                          window.setTimeout(() => setMoodOverlay(null), 1100);
                        }}
                        className={`grid h-9 w-9 place-items-center rounded-full border text-[1.05rem] leading-none transition ${
                          mood === item.key
                            ? "border-[#efb08c] bg-[#fff2e8] shadow-[0_6px_14px_rgba(184,113,93,0.12)]"
                            : "border-[#efe2d6] bg-white/75"
                        }`}
                      >
                        {item.emoji}
                      </button>
                      <p className="mt-1.5 text-[0.62rem] leading-[1.25] text-[#9a7f71]">{item.caption}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <CountWidget
                  title="恋爱时长 2017.09.12"
                  value={loveDuration.primary}
                  accent="love"
                />
                <CountWidget
                  title="婚姻时长 2023.05.22"
                  value={marriageDuration.primary}
                  accent="marriage"
                />
              </div>

              {upcomingReminder ? <BirthdayWidget reminder={upcomingReminder} /> : null}
            </section>

            {pendingReceivedEntries.length > 0 ? (
              <section className="mt-4 glass-panel rounded-[28px] p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[1.35rem] font-semibold text-ink">最新收到</h3>
                  </div>
                  {todayFeedbackEntry ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void triggerTodayFeedback("seen")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          todayFeedbackPulse === "seen"
                            ? "scale-105 border-[#efb08c] bg-[#fff2e8] text-ink"
                            : todayFeedbackEntry.state === "seen"
                              ? "border-[#efb08c] bg-[#fff2e8] text-ink"
                              : "border-[#eadfce] bg-white text-[#6f5c52]"
                        }`}
                      >
                        👀
                      </button>
                      <button
                        type="button"
                        onClick={() => void triggerTodayFeedback("loved")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          todayFeedbackPulse === "loved"
                            ? "scale-105 border-[#efb08c] bg-[#fff2e8] text-ink"
                            : todayFeedbackEntry.state === "loved"
                              ? "border-[#efb08c] bg-[#fff2e8] text-ink"
                              : "border-[#eadfce] bg-white text-[#6f5c52]"
                        }`}
                      >
                        💗
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {pendingReceivedEntries.map((item) => (
                    <div key={item.id} className="rounded-[24px] bg-[#fff6ee] p-3">
                      <p className="text-[0.72rem] text-[#9a7f71]">{formatEntryTime(item.writtenAt)}</p>
                      <p className="mt-1 break-words whitespace-pre-wrap text-[1rem] leading-7 text-ink">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-4 glass-panel rounded-[28px] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.92rem] text-[#8f7568]">今天想说点什么</p>
                  <h2 className="mt-1 text-[1.8rem] font-semibold leading-tight text-ink">写一句给彼此</h2>
                </div>
                <div className="rounded-full bg-[#fff4e6] px-3 py-2 text-sm text-[#c67c4e]">
                  <SunMedium className="inline h-4 w-4" aria-hidden="true" /> 温柔一点
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <KindCard
                  active={kind === "thank_you"}
                  icon="❤️"
                  title="谢谢你"
                  subtitle="表达感谢"
                  onClick={() => setKind("thank_you")}
                />
                <KindCard
                  active={kind === "noticed"}
                  icon="👀"
                  title="我看见了"
                  subtitle="表达关注"
                  onClick={() => setKind("noticed")}
                />
              </div>

              <label className="mt-3 block">
                <span className="sr-only">Today note</span>
                <div className="relative">
                  <textarea
                    value={note}
                    maxLength={220}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={kind === "thank_you" ? "谢谢你..." : "我看见你..."}
                    className="min-h-[170px] w-full resize-none rounded-[24px] border border-[#ead8c9] bg-[#fffdf9] p-4 pb-11 text-base leading-7 outline-none transition placeholder:text-[#c6ab98] focus:border-[#f2a36f] focus:ring-4 focus:ring-[#f2a36f]/15"
                  />
                  <div className="pointer-events-none absolute bottom-3 right-4 text-[0.9rem] font-semibold text-[#6f5c52]">
                    {currentRole === ROLE_BABY ? "👸 宝贝" : currentRole === ROLE_HUSBAND ? "🧸 老公" : "未识别"}
                  </div>
                </div>
              </label>

              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <ScheduleCard
                    active={deliveryMode === "now"}
                    icon="⚡"
                    title="立即送达"
                    subtitle="现在送出"
                    onClick={() => setDeliveryMode("now")}
                  />
                  <ScheduleCard
                    active={deliveryMode === "scheduled"}
                    icon="🌙"
                    title="定时送达"
                    subtitle="选择今天时间"
                    onClick={() => setDeliveryMode("scheduled")}
                  />
                </div>
                {deliveryMode === "scheduled" ? (
                  <div className="mt-2.5 rounded-[20px] border border-[#eadfce] bg-[#fffaf4] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.86rem] font-medium text-[#8f7568]">今天送达时间</p>
                      <div className="flex items-center gap-2">
                        <select
                          value={deliveryTime.slice(0, 2)}
                          onChange={(event) =>
                            setDeliveryTime(`${event.target.value}:${deliveryTime.slice(3, 5)}`)
                          }
                          className="rounded-[14px] border border-[#ead8c9] bg-white px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-[#f2a36f] focus:ring-4 focus:ring-[#f2a36f]/15"
                        >
                          {hourOptions.map((hour) => (
                            <option key={hour} value={hour}>
                              {hour}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm font-semibold text-[#8f7568]">:</span>
                        <select
                          value={deliveryTime.slice(3, 5)}
                          onChange={(event) =>
                            setDeliveryTime(`${deliveryTime.slice(0, 2)}:${event.target.value}`)
                          }
                          className="rounded-[14px] border border-[#ead8c9] bg-white px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-[#f2a36f] focus:ring-4 focus:ring-[#f2a36f]/15"
                        >
                          {minuteOptions.map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-[#8f7568]">选择立即送达后，对方会马上收到这句话。</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#f4a06f] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_28px_rgba(244,160,111,0.28)] transition hover:bg-[#ef955f]"
              >
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                {saveLabel}
              </button>
              <p className="mt-2 text-xs text-[#8f7568]">{saveStatus}</p>
              {authError ? <p className="mt-3 text-sm leading-6 text-[#c45f47]">{authError}</p> : null}
            </section>

            {pendingReceivedEntries.length === 0 ? (
              <section className="mt-4 glass-panel rounded-[28px] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-[1.35rem] font-semibold text-ink">最新收到</h3>
                  </div>
                </div>

                <div className="rounded-[24px] bg-[#fff6ee] p-4">
                  <p className="text-sm text-[#8f7568]">还没有收到新的内容。</p>
                </div>
              </section>
            ) : null}
          </>
        ) : tab === "memory" ? (
          <>
            <section className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[2rem] font-semibold leading-none tracking-[0.01em]">回忆</h1>
                  <p className="mt-1 text-[0.92rem] text-[#8f7568]">历史记录与月度回顾</p>
                </div>
                <div className="rounded-full bg-white/70 px-2 py-1 shadow-sm">
                  <AvatarStack />
                </div>
              </div>
            </section>

            <section className="mt-4 space-y-3">
              <HistoryPanel
                activeTab={historyTab}
                onTabChange={setHistoryTab}
                sentEntries={sentEntries}
                receivedEntries={receivedEntries}
                selectedEntryId={selectedHistoryEntry?.id ?? null}
                onSelectEntry={setSelectedHistoryEntry}
                onDeleteEntry={handleDeleteEntry}
              />
              <OverallStatsCard stats={overallStats} />
              <MonthlyReviewCard
                review={monthlyReview}
                onPreviousMonth={() => setReviewMonthOffset((current) => current - 1)}
                onNextMonth={() => setReviewMonthOffset((current) => current + 1)}
              />
            </section>
          </>
        ) : (
          <>
            <section className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[2rem] font-semibold leading-none tracking-[0.01em]">我的</h1>
                  <p className="mt-1 text-[0.92rem] text-[#8f7568]">当前登录账号和设置</p>
                </div>
              </div>
            </section>

            <section className="mt-4 space-y-3">
              <div className="glass-panel rounded-[28px] p-4">
                <p className="text-sm text-[#8f7568]">当前身份</p>
                <div className="mt-2">
                  <div>
                    <p className="text-[1.2rem] font-semibold text-ink">{currentRoleLabel || "未识别"}</p>
                    <p className="mt-1 text-sm text-[#8f7568]">{currentUserEmail}</p>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-[28px] p-4">
                <p className="text-sm text-[#8f7568]">提醒</p>
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  className="mt-3 flex w-full items-center justify-between rounded-[24px] border border-[#eadfce] bg-white/80 px-4 py-3.5 text-left transition hover:bg-white"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-[1rem] font-semibold text-ink">开启提醒</p>
                    <p className="mt-1 text-xs leading-5 text-[#8f7568]">
                      收到对方消息时，手机会弹出通知
                    </p>
                  </div>
                  <div
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      pushEnabled ? "bg-[#f39a78]" : "bg-[#ded3c7]"
                    }`}
                    aria-hidden="true"
                  >
                    <div
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition ${
                        pushEnabled ? "left-5" : "left-0.5"
                      }`}
                    />
                  </div>
                </button>
                {pushStatus ? <p className="mt-2 text-xs leading-6 text-[#8f7568]">{pushStatus}</p> : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#fff2e8] px-5 py-4 text-base font-semibold text-[#c45f47] transition hover:bg-[#ffe7d8]"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  退出登录
                </button>
              </div>
            </section>
          </>
        )}

      </div>

      {selectedHistoryEntry ? (
        <div className="fixed inset-0 z-[60] bg-black/25 px-4 py-6" onClick={() => setSelectedHistoryEntry(null)}>
          <div
            className="mx-auto mt-24 w-full max-w-[520px] rounded-[28px] bg-[#fffdf9] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#8f7568]">
                  {selectedHistoryEntry.kind === "thank_you" ? "谢谢你" : "我看见了"}
                </p>
                <p className="mt-1 text-sm text-[#8f7568]">{formatEntryDate(selectedHistoryEntry.writtenAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryEntry(null)}
                className="rounded-full px-2 py-1 text-sm font-semibold text-[#8f7568]"
              >
                关闭
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-[1rem] leading-7 text-ink">
              {selectedHistoryEntry.body}
            </p>
            <div className="mt-5 flex justify-end">
              {selectedHistoryEntry.from === myName ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteEntry(selectedHistoryEntry);
                    setSelectedHistoryEntry(null);
                  }}
                  className="rounded-[18px] bg-[#fff2e8] px-4 py-2 text-sm font-semibold text-[#c45f47]"
                >
                  删除
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {sendSuccessVisible ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[#fffdf9]/98 px-4 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
            <div className="animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-[#fff2e8] p-5 shadow-[0_20px_50px_rgba(244,160,111,0.18)]">
              <Sparkles className="h-12 w-12 text-[#f39a78]" aria-hidden="true" />
            </div>
            <p className="mt-5 text-[1.6rem] font-semibold text-ink">
              {sendSuccessMode === "scheduled" ? "你的爱意即将送达" : "你的爱意已经发送了"}
            </p>
            <p className="mt-2 text-sm text-[#8f7568]">
              {sendSuccessMode === "scheduled" ? "会在你选定的时间悄悄送到对方那里" : "悄悄送到对方那里了"}
            </p>
          </div>
        </div>
      ) : null}

      {todayFeedbackOverlay ? (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-[#fffdf9]/98 px-4 backdrop-blur-[2px]">
          {todayFeedbackOverlay === "seen" ? (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-28 w-28 rounded-full bg-[#eef4ff] opacity-80 animate-[ping_1.1s_ease-out_infinite]" />
                <div className="absolute h-20 w-20 rounded-full bg-[#fff] shadow-[0_20px_50px_rgba(132,162,214,0.18)] animate-[pulse_0.9s_ease-in-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[bounce_0.9s_ease-in-out_infinite]">👀</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">你已经看见了</p>
              <p className="mt-2 text-sm text-[#8f7568]">这一刻被认真收到了</p>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <div className="absolute h-32 w-32 rounded-full bg-[#ffe9ef] opacity-70 animate-[pulse_0.8s_ease-in-out_infinite]" />
                <div className="absolute h-24 w-24 rounded-full bg-[#fff2f5] shadow-[0_20px_50px_rgba(244,111,146,0.18)] animate-[spin_1.4s_linear_infinite]" />
                <span className="relative text-[4.4rem] leading-none animate-[pulse_0.75s_ease-in-out_infinite]">💗</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">你已经喜欢了</p>
              <p className="mt-2 text-sm text-[#8f7568]">这份心意正在发亮</p>
            </div>
          )}
        </div>
      ) : null}

      {moodOverlay ? (
        <div className="fixed inset-0 z-[67] flex items-center justify-center bg-[#fffdf9]/98 px-4 backdrop-blur-[2px]">
          {moodOverlay === "celebrating" ? (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-28 w-28 rounded-full bg-[#fff0dc] opacity-80 animate-[ping_1.2s_ease-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[bounce_0.9s_ease-in-out_infinite]">🥳</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">今天亮晶晶的</p>
              <p className="mt-2 text-sm text-[#8f7568]">把开心轻轻放在这里了</p>
            </div>
          ) : moodOverlay === "soft" ? (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full bg-[#fff4e8] opacity-85 animate-[pulse_1s_ease-in-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[pulse_1s_ease-in-out_infinite]">😊</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">今天很温柔</p>
              <p className="mt-2 text-sm text-[#8f7568]">这一刻被安安静静地记住了</p>
            </div>
          ) : moodOverlay === "blank" ? (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full bg-[#f7f2ec] opacity-90 animate-[pulse_1.2s_ease-in-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[pulse_1.2s_ease-in-out_infinite]">🫥</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">今天想慢一点</p>
              <p className="mt-2 text-sm text-[#8f7568]">就这样发会儿呆也没关系</p>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[32px] border border-[#eadfce] bg-[#fffdf9] px-6 py-8 text-center shadow-[0_20px_60px_rgba(150,115,83,0.12)]">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full bg-[#fff0ea] opacity-80 animate-[pulse_0.95s_ease-in-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[translateY(0)]">😣</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">今天辛苦了</p>
              <p className="mt-2 text-sm text-[#8f7568]">先抱一抱自己，再慢慢往前走</p>
            </div>
          )}
        </div>
      ) : null}

      {dailyReminderVisible ? (
        <div className="fixed inset-x-0 top-4 z-[67] px-4">
          <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 rounded-[22px] bg-[#fff7ef] px-4 py-3 text-sm text-[#6f5c52] shadow-[0_16px_32px_rgba(150,115,83,0.12)]">
            <span>今天还没写一句，今晚 8 点后记得留一点给彼此。</span>
            <button
              type="button"
              onClick={() => setDailyReminderVisible(false)}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#c67c4e]"
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] m-0 p-0">
        <div className="mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="pointer-events-auto rounded-[28px] border border-[#f1e3d2] bg-[#fcf7f1]/96 px-3 py-2.5 text-xs text-[#6f5c52] shadow-[0_-10px_28px_rgba(121,90,68,0.16)] backdrop-blur-2xl">
            <div className="grid grid-cols-3 gap-2">
              <NavItem
                active={tab === "home"}
                icon={<PenLine className="h-5 w-5" />}
                label="首页"
                onClick={() => setTab("home")}
              />
              <NavItem
                active={tab === "memory"}
                icon={<Library className="h-5 w-5" />}
                label="回忆"
                onClick={() => setTab("memory")}
              />
              <NavItem
                active={tab === "me"}
                icon={<UserRound className="h-5 w-5" />}
                label="我的"
                onClick={() => setTab("me")}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function KindCard({
  active,
  icon,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border px-3 py-3 text-left transition ${
        active ? "border-[#efb08c] bg-[#fff2e8]" : "border-[#eadfce] bg-[#fffdf9]"
      }`}
    >
      <div className="text-2xl leading-none">{icon}</div>
      <div className="mt-3">
        <div className="text-[0.92rem] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[0.72rem] leading-tight text-[#8f7568]">{subtitle}</div>
      </div>
    </button>
  );
}

function ScheduleCard({
  active,
  icon,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border px-3 py-2 text-center transition ${
        active ? "border-[#efb08c] bg-[#fff2e8]" : "border-[#eadfce] bg-[#fffdf9]"
      }`}
    >
      <div className="text-xl leading-none">{icon}</div>
      <div className="mt-1.5 text-[0.92rem] font-semibold text-ink">{title}</div>
      <div className="mt-0.5 text-[0.72rem] leading-tight text-[#8f7568]">{subtitle}</div>
    </button>
  );
}

function AvatarStack() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-[36px] w-[36px] place-items-center rounded-full bg-[#fff4ea]">
        <span className="text-[2rem] leading-none">👸</span>
      </div>
      <div className="grid h-[36px] w-[36px] place-items-center rounded-full bg-[#fff4ea]">
        <span className="text-[2rem] leading-none">🧸</span>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 transition-all duration-200 ease-out ${
        active ? "font-semibold text-[#c86f45]" : "text-[#6d574b]"
      }`}
    >
      <div
        className={`grid h-8 w-8 place-items-center rounded-full transition-all duration-200 ease-out ${
          active ? "bg-[#fff1e3] text-[#c86f45]" : "bg-transparent text-[#7a675d]"
        }`}
      >
        {icon}
      </div>
      <span className="text-[0.84rem] transition-colors duration-200 ease-out">{label}</span>
    </button>
  );
}

function MemoryCard({
  title,
  subtitle,
  emptyText
}: {
  title: string;
  subtitle: string;
  emptyText: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#eadfce] bg-[#fffdf9] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[0.98rem] font-semibold text-ink">{title}</p>
          <p className="text-xs text-[#8f7568]">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[#fff4ea] px-3 py-1 text-xs text-[#c67c4e]">查看</span>
      </div>
      <p className="text-sm leading-7 text-[#8f7568]">{emptyText}</p>
    </div>
  );
}

function OverallStatsCard({
  stats
}: {
  stats: Array<{
    name: "Maia" | "Husband";
    thankYouCount: number;
    noticedCount: number;
    totalCount: number;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,253,249,0.98),rgba(255,247,239,0.96))] shadow-[0_12px_28px_rgba(165,120,89,0.08)]">
      <div className="border-b border-[#efe3d6] px-4 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[1rem] font-semibold text-ink">累计统计</p>
            <p className="mt-1 text-xs text-[#8f7568]">两个人分别发出了多少条感谢与看见</p>
          </div>
          <div className="rounded-full bg-white/85 px-3 py-1 text-[0.72rem] font-semibold text-[#c67c4e] shadow-sm">
            自动更新
          </div>
        </div>
      </div>

      <div className="px-4 py-3.5">
        <div className="overflow-hidden rounded-[20px] border border-[#efdfce] bg-white/88">
          <div className="grid grid-cols-[1.1fr_0.78fr_0.78fr_0.72fr] items-center bg-[linear-gradient(180deg,#fff5ec,#fff1e5)] px-3 py-2 text-[0.72rem] font-semibold tracking-[0.01em] text-[#937768]">
            <span>来自</span>
            <span className="text-center text-[#cb6f60]">❤</span>
            <span className="text-center text-[#ab906a]">👀</span>
            <span className="text-center">总数</span>
          </div>

          {stats.map((row, index) => (
            <div
              key={row.name}
              className={`grid grid-cols-[1.1fr_0.78fr_0.78fr_0.72fr] items-center px-3 py-2.5 ${
                index > 0 ? "border-t border-[#f4eadf]" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#fff3e8] text-[1.05rem] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  {row.name === "Maia" ? "👸" : "🧸"}
                </div>
                <p className="truncate text-[0.92rem] font-semibold text-ink">{row.name === "Maia" ? "宝贝" : "老公"}</p>
              </div>

              <div className="flex justify-center">
                <div className="min-w-[2.8rem] rounded-[12px] border border-[#f1d6d0] bg-[linear-gradient(180deg,#fff4f1,#fffaf8)] px-1.5 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  <p className="text-[0.98rem] font-semibold leading-none text-[#cb6f60]">{row.thankYouCount}</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="min-w-[2.8rem] rounded-[12px] border border-[#efe2ce] bg-[linear-gradient(180deg,#fff8ee,#fffdf9)] px-1.5 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  <p className="text-[0.98rem] font-semibold leading-none text-[#ab906a]">{row.noticedCount}</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[0.96rem] font-semibold leading-none text-[#6d574b]">{row.totalCount}</p>
                <p className="mt-0.5 text-[0.62rem] text-[#a18779]">条</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function CountWidget({
  title,
  value,
  accent
}: {
  title: string;
  value: string;
  accent: "love" | "marriage";
}) {
  const palette =
    accent === "love"
      ? {
          shell: "border-[#f1d7cd] bg-[linear-gradient(160deg,rgba(255,250,246,0.98),rgba(255,241,232,0.96))]",
          badge: "bg-[#fff5ee] text-[#d78d72]",
          glow: "bg-[radial-gradient(circle_at_top_right,rgba(244,160,111,0.18),transparent_58%)]",
          mark: "❤"
        }
      : {
          shell: "border-[#e3dccf] bg-[linear-gradient(160deg,rgba(255,252,247,0.98),rgba(246,240,231,0.96))]",
          badge: "bg-[#f8f2e8] text-[#baa074]",
          glow: "bg-[radial-gradient(circle_at_top_right,rgba(210,188,141,0.2),transparent_58%)]",
          mark: "✦"
        };

  return (
    <div className={`relative overflow-hidden rounded-[22px] border px-3 py-2.5 shadow-[0_10px_18px_rgba(184,113,93,0.07)] ${palette.shell}`}>
      <div className={`pointer-events-none absolute inset-0 ${palette.glow}`} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.67rem] font-medium leading-none text-[#8f7568]">{title}</p>
          <p className="mt-1 text-[1.02rem] font-semibold leading-none text-ink">{value}</p>
        </div>
        <div className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${palette.badge}`}>
          {palette.mark}
        </div>
      </div>
    </div>
  );
}

function BirthdayWidget({
  reminder
}: {
  reminder: { title: string; detail: string };
}) {
  return (
    <div className="mt-3 rounded-[24px] border border-[#eadfce] bg-[#fff6ee]/95 p-4 shadow-[0_10px_18px_rgba(184,113,93,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.86rem] font-medium text-[#8f7568]">近期提醒</p>
          <p className="mt-1 text-[1.05rem] font-semibold text-ink">{reminder.title}</p>
          <p className="mt-2 text-sm leading-6 text-[#8f7568]">{reminder.detail}</p>
        </div>
        <div className="rounded-full bg-white px-3 py-2 text-xl leading-none shadow-sm">🎂</div>
      </div>
    </div>
  );
}

function MonthlyReviewCard({
  review,
  onPreviousMonth,
  onNextMonth
}: {
  review: {
    monthLabel: string;
    isFutureMonth: boolean;
    sentCount: number;
    receivedCount: number;
    thankYouCount: number;
    noticedCount: number;
    recentLine: string | null;
    reflectionTitle: string;
    reflectionBody: string;
    rhythmLine: string;
    highlightDayLine: string;
    mutualLine: string;
    spotlightLines: string[];
    calendarDays: Array<{
      key: string;
      dayNumber: number | null;
      hasBaby: boolean;
      hasHusband: boolean;
      isCurrentMonth: boolean;
    }>;
  };
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-[#eadfce] bg-[#fffdf9] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[0.98rem] font-semibold text-ink">月度回顾</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-[#8f7568]">
            <button
              type="button"
              onClick={onPreviousMonth}
              className="grid h-6 w-6 place-items-center rounded-full bg-[#fff4ea] text-[#c67c4e]"
              aria-label="上个月"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <p>{review.monthLabel}</p>
            <button
              type="button"
              onClick={onNextMonth}
              className="grid h-6 w-6 place-items-center rounded-full bg-[#fff4ea] text-[#c67c4e]"
              aria-label="下个月"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <span className="rounded-full bg-[#fff4ea] px-3 py-1 text-xs text-[#c67c4e]">自动生成</span>
      </div>

      {review.isFutureMonth ? (
        <p className="text-sm leading-7 text-[#8f7568]">这个月还没开始。</p>
      ) : review.sentCount === 0 && review.receivedCount === 0 ? (
        <p className="text-sm leading-7 text-[#8f7568]">这个月还没有内容，等你们慢慢写下来。</p>
      ) : (
        <div className="space-y-2.5 text-sm leading-6 text-[#6f5c52]">
          <div className="rounded-[20px] bg-[#fff6ee] p-3.5">
            <p className="text-[0.92rem] font-semibold text-ink">{review.reflectionTitle}</p>
            <p className="mt-2 text-sm leading-7 text-[#6f5c52]">{review.reflectionBody}</p>
          </div>

          <div className="rounded-[20px] bg-[#fff8f1] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.86rem] font-medium text-[#8f7568]">发送日历</p>
              <div className="flex items-center gap-3 text-[0.72rem] text-[#8f7568]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f4a06f]" />
                  宝贝
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#c9ab7b]" />
                  老公
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-[0.68rem] text-[#b09583]">
              {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
                <div key={label} className="font-medium">
                  {label}
                </div>
              ))}
              {review.calendarDays.map((day) => (
                <div
                  key={day.key}
                  className={`mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-[14px] ${
                    day.isCurrentMonth ? "bg-[#fffdf9]" : "bg-transparent"
                  }`}
                >
                  <span className={day.isCurrentMonth ? "text-[#6f5c52]" : "text-transparent"}>{day.dayNumber ?? ""}</span>
                  <span className="mt-0.5 flex items-center gap-1">
                    {day.hasBaby ? <span className="h-1.5 w-1.5 rounded-full bg-[#f4a06f]" /> : null}
                    {day.hasHusband ? <span className="h-1.5 w-1.5 rounded-full bg-[#c9ab7b]" /> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 rounded-[20px] bg-[#fffdf9] px-3 py-3">
            <p>{review.rhythmLine}</p>
            <p>{review.highlightDayLine}</p>
            <p>{review.mutualLine}</p>
          </div>
          {review.spotlightLines.length > 0 ? (
            <div className="space-y-2">
              {review.spotlightLines.map((line, index) => (
                <div key={`${line}-${index}`} className="rounded-[18px] bg-[#fff6ee] px-3 py-2.5 text-ink">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  activeTab,
  onTabChange,
  sentEntries,
  receivedEntries,
  selectedEntryId,
  onSelectEntry,
  onDeleteEntry
}: {
  activeTab: "sent" | "received";
  onTabChange: (tab: "sent" | "received") => void;
  sentEntries: GratitudeEntry[];
  receivedEntries: GratitudeEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: GratitudeEntry) => void;
  onDeleteEntry: (entry: GratitudeEntry) => void;
}) {
  const activeEntries = activeTab === "sent" ? sentEntries : receivedEntries;
  const [showAllEntries, setShowAllEntries] = useState(false);
  const visibleEntries = showAllEntries ? activeEntries : activeEntries.slice(0, 5);

  return (
    <div className="rounded-[24px] border border-[#eadfce] bg-[#fffdf9] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.98rem] font-semibold text-ink">历史记录</p>
          <p className="text-xs text-[#8f7568]">
            {showAllEntries ? "全部历史记录" : "最近 5 条"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAllEntries((current) => !current)}
          className="rounded-full bg-[#fff4ea] px-3 py-1 text-xs font-semibold text-[#c67c4e]"
        >
          {showAllEntries ? "最近" : "全部"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-[#f6efe7] p-1">
        <HistoryTabButton
          active={activeTab === "sent"}
          label="你发出的"
          onClick={() => onTabChange("sent")}
        />
        <HistoryTabButton
          active={activeTab === "received"}
          label="你收到的"
          onClick={() => onTabChange("received")}
        />
      </div>
      <div className="mt-3">
        {activeEntries.length === 0 ? (
          <p className="text-sm leading-7 text-[#8f7568]">
            {activeTab === "sent" ? "你还没有发出过内容。" : "你还没有收到过内容。"}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleEntries.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectEntry(item)}
                className={`flex w-full min-w-0 items-center overflow-hidden rounded-[18px] bg-[#fff6ee] p-3 text-left transition ${
                  selectedEntryId === item.id ? "ring-2 ring-[#efb08c]" : ""
                }`}
              >
                <p className="truncate text-sm leading-6 text-ink">{item.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[16px] px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-ink shadow-sm" : "text-[#8f7568]"
      }`}
    >
      {label}
    </button>
  );
}

function resolveRole(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (babyEmail && normalized === babyEmail) return ROLE_BABY;
  if (husbandEmail && normalized === husbandEmail) return ROLE_HUSBAND;
  if (normalized.includes("maia")) return ROLE_BABY;
  if (normalized.includes("husband")) return ROLE_HUSBAND;
  return null;
}

function formatLocalEntryDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatEntryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRelationshipDuration(startDateText: string) {
  const startDate = new Date(`${startDateText}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - startDate.getFullYear();
  let months = now.getMonth() - startDate.getMonth();
  let days = now.getDate() - startDate.getDate();

  if (days < 0) {
    const previousMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += previousMonthLastDay;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return {
    primary: `${years} 年 ${months} 个月`,
    secondary: `${years} 年 ${months} 个月 ${days} 天`
  };
}

function buildScheduledDeliverAt(baseDate: Date, timeValue: string) {
  const [hoursText, minutesText] = timeValue.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);

  if (scheduled.getTime() <= baseDate.getTime()) {
    return null;
  }

  return scheduled.toISOString();
}

function isDeliveredForViewer(entry: GratitudeEntry) {
  return new Date(entry.deliveredAt).getTime() <= Date.now();
}

function isPendingScheduledEntry(entry: GratitudeEntry) {
  return new Date(entry.deliveredAt).getTime() > Date.now();
}

function getUpcomingReminder(now: Date) {
  const upcomingItems = [
    {
      kind: "birthday",
      label: "宝贝的生日",
      month: BABY_BIRTHDAY.month,
      day: BABY_BIRTHDAY.day
    },
    {
      kind: "birthday",
      label: "老公的生日",
      month: HUSBAND_BIRTHDAY.month,
      day: HUSBAND_BIRTHDAY.day
    },
    {
      kind: "anniversary",
      label: "恋爱纪念日",
      month: Number(LOVE_START_DATE.slice(5, 7)),
      day: Number(LOVE_START_DATE.slice(8, 10))
    },
    {
      kind: "anniversary",
      label: "结婚纪念日",
      month: Number(MARRIAGE_START_DATE.slice(5, 7)),
      day: Number(MARRIAGE_START_DATE.slice(8, 10))
    }
  ]
    .map((item) => {
      const next = new Date(now.getFullYear(), item.month - 1, item.day);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (next < todayStart) {
        next.setFullYear(now.getFullYear() + 1);
      }
      const dayMs = 24 * 60 * 60 * 1000;
      const daysLeft = Math.round((next.getTime() - todayStart.getTime()) / dayMs);
      return { ...item, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const nextItem = upcomingItems[0];
  if (!nextItem || nextItem.daysLeft > UPCOMING_REMINDER_WINDOW_DAYS) {
    return null;
  }

  if (nextItem.daysLeft === 0) {
    return {
      title: `今天是${nextItem.label}`,
      detail:
        nextItem.kind === "birthday"
          ? "别忘了今天多准备一点惊喜。"
          : "今天值得好好纪念一下。"
    };
  }

  return {
    title: `快到${nextItem.label}了`,
    detail: `还有 ${nextItem.daysLeft} 天，就是${nextItem.label}。`
  };
}

function buildMonthlyReview({
  sentEntries,
  receivedEntries,
  reviewMonth,
  currentDate
}: {
  sentEntries: GratitudeEntry[];
  receivedEntries: GratitudeEntry[];
  reviewMonth: Date;
  currentDate: Date;
}) {
  const monthStartDate = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth(), 1);
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const isFutureMonth = monthStartDate.getTime() > currentMonthStart.getTime();
  const monthStart = monthStartDate.getTime();
  const monthEnd = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth() + 1, 1).getTime();
  const currentMonthEntries = [...sentEntries, ...receivedEntries]
    .filter((item) => {
      const time = new Date(item.writtenAt).getTime();
      return time >= monthStart && time < monthEnd;
    })
    .sort((a, b) => new Date(b.writtenAt).getTime() - new Date(a.writtenAt).getTime());

  const monthLabel = `${reviewMonth.getFullYear()} 年 ${reviewMonth.getMonth() + 1} 月`;
  const sentCount = currentMonthEntries.filter((item) => sentEntries.some((sent) => sent.id === item.id)).length;
  const receivedCount = currentMonthEntries.filter((item) => receivedEntries.some((received) => received.id === item.id)).length;
  const thankYouCount = currentMonthEntries.filter((item) => item.kind === "thank_you").length;
  const noticedCount = currentMonthEntries.filter((item) => item.kind === "noticed").length;
  const recentLine = currentMonthEntries[0]?.body ?? null;
  const uniqueDays = Array.from(new Set(currentMonthEntries.map((item) => new Date(item.writtenAt).getDate()))).sort((a, b) => a - b);
  const dayMap = new Map<number, { hasBaby: boolean; hasHusband: boolean }>();
  const dayEntryCount = new Map<number, number>();
  const sentDaySet = new Set<number>();
  const receivedDaySet = new Set<number>();
  const sentThisMonth = currentMonthEntries.filter((item) => sentEntries.some((sent) => sent.id === item.id));
  const receivedThisMonth = currentMonthEntries.filter((item) => receivedEntries.some((received) => received.id === item.id));

  currentMonthEntries.forEach((item) => {
    const dayNumber = new Date(item.writtenAt).getDate();
    const current = dayMap.get(dayNumber) ?? { hasBaby: false, hasHusband: false };
    if (item.from === "Maia") current.hasBaby = true;
    if (item.from === "Husband") current.hasHusband = true;
    dayMap.set(dayNumber, current);
    dayEntryCount.set(dayNumber, (dayEntryCount.get(dayNumber) ?? 0) + 1);
  });

  sentThisMonth.forEach((item) => {
    sentDaySet.add(new Date(item.writtenAt).getDate());
  });

  receivedThisMonth.forEach((item) => {
    receivedDaySet.add(new Date(item.writtenAt).getDate());
  });

  const firstWeekday = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) {
      return {
        key: `blank-${index}`,
        dayNumber: null,
        hasBaby: false,
        hasHusband: false,
        isCurrentMonth: false
      };
    }

    const dayNumber = index - firstWeekday + 1;
    const flags = dayMap.get(dayNumber) ?? { hasBaby: false, hasHusband: false };
    return {
      key: `day-${dayNumber}`,
      dayNumber,
      hasBaby: flags.hasBaby,
      hasHusband: flags.hasHusband,
      isCurrentMonth: true
    };
  });

  const activeDayCount = uniqueDays.length;
  const longestStreak = getLongestStreak(uniqueDays);
  const busiestDayEntry = Array.from(dayEntryCount.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const sharedDays = Array.from(sentDaySet).filter((day) => receivedDaySet.has(day)).sort((a, b) => a - b);
  const spotlightEntry = currentMonthEntries.find((item) => item.body.trim().length >= 12) ?? currentMonthEntries[0] ?? null;
  const closingEntry = currentMonthEntries[currentMonthEntries.length - 1] ?? null;
  const busiestDayLine = busiestDayEntry
    ? `${monthLabel}里最热闹的是 ${busiestDayEntry[0]} 号，那天你们一共留下了 ${busiestDayEntry[1]} 条内容。`
    : `${monthLabel}里还没有特别集中的记录日。`;
  const balanceLine =
    thankYouCount >= noticedCount
      ? `这个月你们更常把“谢谢你”说出口，感谢被认真地留了下来。`
      : `这个月你们更常写下“我看见了”，彼此的状态被更细致地接住了。`;
  const rhythmLine =
    activeDayCount === 0
      ? "这个月还没有留下记录。"
      : longestStreak > 1
        ? `这个月有 ${activeDayCount} 天留下了内容，最长连续记录了 ${longestStreak} 天。`
        : `这个月有 ${activeDayCount} 天留下了内容，节奏还比较松，但每一次记录都被留下来了。`;
  const reflectionTitle =
    thankYouCount === 0 && noticedCount === 0
      ? "这个月还很安静"
      : thankYouCount >= noticedCount
        ? "这个月，你们把感谢说得更多了一点"
        : "这个月，你们更常认真看见彼此";
  const reflectionBody =
    currentMonthEntries.length === 0
      ? "还没有足够内容生成回顾。"
      : `${balanceLine}${spotlightEntry ? ` 这个月很像被这句话轻轻记住了：“${spotlightEntry.body}”` : ""}`;
  const mutualLine =
    currentMonthEntries.length === 0
      ? "等写下第一句之后，这里会慢慢长成真正的回顾。"
      : sharedDays.length > 0
        ? `这个月有 ${sharedDays.length} 天是你来我往的双向表达，不只是被看见，也有被回应。`
        : "这个月的内容还没有落在同一天彼此回应，但每一条都已经在关系里留下痕迹。";
  const thankYouSpotlight = currentMonthEntries.find((item) => item.kind === "thank_you")?.body ?? null;
  const noticedSpotlight = currentMonthEntries.find((item) => item.kind === "noticed")?.body ?? null;
  const spotlightLines = [
    thankYouSpotlight ? `这个月的一句谢谢：${thankYouSpotlight}` : null,
    noticedSpotlight ? `这个月的一句看见：${noticedSpotlight}` : null,
    closingEntry ? `这个月最早留下的一句：${closingEntry.body}` : null
  ].filter((item): item is string => Boolean(item));

  return {
    monthLabel,
    isFutureMonth,
    sentCount,
    receivedCount,
    thankYouCount,
    noticedCount,
    recentLine,
    reflectionTitle,
    reflectionBody,
    rhythmLine,
    highlightDayLine: busiestDayLine,
    mutualLine,
    spotlightLines,
    calendarDays
  };
}

function buildOverallStats(historyEntries: GratitudeEntry[]) {
  const statsMap = new Map<"Maia" | "Husband", { thankYouCount: number; noticedCount: number }>([
    ["Maia", { thankYouCount: 0, noticedCount: 0 }],
    ["Husband", { thankYouCount: 0, noticedCount: 0 }]
  ]);

  historyEntries.forEach((item) => {
    const current = statsMap.get(item.from);
    if (!current) return;

    if (item.kind === "thank_you") {
      current.thankYouCount += 1;
    } else {
      current.noticedCount += 1;
    }
  });

  return [
    {
      name: "Maia" as const,
      ...statsMap.get("Maia")!,
      totalCount: (statsMap.get("Maia")?.thankYouCount ?? 0) + (statsMap.get("Maia")?.noticedCount ?? 0)
    },
    {
      name: "Husband" as const,
      ...statsMap.get("Husband")!,
      totalCount:
        (statsMap.get("Husband")?.thankYouCount ?? 0) + (statsMap.get("Husband")?.noticedCount ?? 0)
    }
  ];
}

function getLongestStreak(days: number[]) {
  if (days.length === 0) return 0;
  let longest = 1;
  let current = 1;

  for (let index = 1; index < days.length; index += 1) {
    if (days[index] === days[index - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function mapEntryRowToUi(
  row: GratitudeEntryRow,
  currentUserId: string,
  currentMemberName: string,
  partnerMemberName: string
): GratitudeEntry {
  return {
    id: row.id,
    kind: row.kind,
    authorUserId: row.author_id,
    recipientUserId: row.recipient_id,
    from: (row.author_id === currentUserId ? currentMemberName : partnerMemberName) as GratitudeEntry["from"],
    to: (row.recipient_id === currentUserId ? currentMemberName : partnerMemberName) as GratitudeEntry["to"],
    body: row.body,
    writtenAt: row.created_at,
    deliveredAt: row.delivered_at ?? row.deliver_at,
    state: row.recipient_reaction === "loved" ? "loved" : row.recipient_reaction === "seen" ? "seen" : "new"
  };
}
