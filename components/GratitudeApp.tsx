"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
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

const STORAGE_KEY = "gratitude-local-history";
const ROLE_BABY = "baby";
const ROLE_HUSBAND = "husband";
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
  const [historyTab, setHistoryTab] = useState<"sent" | "received">("sent");
  const [kind, setKind] = useState<EntryKind>("thank_you");
  const [sender, setSender] = useState<Sender | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [note, setNote] = useState("");
  const [historyEntries, setHistoryEntries] = useState<GratitudeEntry[]>(entries);
  const [deliveryTime] = useState(defaultDeliveryTime);
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
  const [todayFeedbackPulse, setTodayFeedbackPulse] = useState<"seen" | "loved" | null>(null);
  const [todayFeedbackOverlay, setTodayFeedbackOverlay] = useState<"seen" | "loved" | null>(null);
  const [pushStatus, setPushStatus] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  const readableDeliveryTime = formatDeliveryTime(deliveryTime);
  const currentRole = resolveRole(currentUserEmail);
  const currentRoleLabel = currentRole === ROLE_BABY ? "宝贝" : currentRole === ROLE_HUSBAND ? "老公" : "";
  const myName = currentMemberName || (currentRole === ROLE_BABY ? "Maia" : currentRole === ROLE_HUSBAND ? "Husband" : "");
  const sentEntries = historyEntries.filter((item) => item.from === myName);
  const receivedEntries = historyEntries.filter((item) => item.to === myName);
  const saveLabel = "发送爱意";
  const todayKey = formatLocalEntryDate(new Date());
  const todayEntries = receivedEntries.filter((item) => item.writtenAt.slice(0, 10) === todayKey);
  const todayFeedbackEntry = todayEntries[0] ?? null;

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

      const payload = {
        couple_id: activeCoupleId,
        author_id: activeCurrentUserId,
        recipient_id: partnerUserId,
        kind,
        body: note.trim(),
        local_entry_date: formatLocalEntryDate(createdAt),
        deliver_at:
          deliveryMode === "now" ? createdAt.toISOString() : new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString(),
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
      setNote("");
      setDeliveryMode(null);
      setAuthError(null);
      setSaveStatus("");
      setSendSuccessVisible(true);
      window.setTimeout(() => {
        setSendSuccessVisible(false);
      }, 1600);
    } catch (error) {
      setSaveStatus("异常");
      setAuthError(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("gratitude_entries").delete().eq("id", entryId);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setHistoryEntries((current) => current.filter((item) => item.id !== entryId));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleReactEntry = async (entryId: string, reaction: "seen" | "loved") => {
    try {
      const supabase = getSupabaseBrowserClient();
      const now = new Date().toISOString();
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "更新失败");
    }
  };

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      setAuthLoading(false);
      supabase.auth
        .getSession()
        .then(({ data }) => {
          const sessionEmail = data.session?.user.email?.toLowerCase() ?? "";
          setCurrentUserEmail(sessionEmail);
          setCurrentUserId(data.session?.user.id ?? "");
        })
        .catch((error) => {
          setAuthError(error instanceof Error ? error.message : "Supabase 会话读取失败");
        });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const nextEmail = session?.user.email?.toLowerCase() ?? "";
        setCurrentUserEmail(nextEmail);
        setCurrentUserId(session?.user.id ?? "");
        setAuthLoading(false);
      });

      return () => {
        data.subscription.unsubscribe();
      };
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Supabase 初始化失败");
      setAuthLoading(false);
    }
  }, []);

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
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const historyCount = historyEntries.length;
  const memoryEntries = historyEntries;

  if (authLoading) {
    return (
      <main className="warm-shell min-h-screen bg-paper text-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center px-4">
          <div className="glass-panel w-full rounded-[28px] p-5 text-center text-sm text-[#8f7568]">
            正在检查登录状态...
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
                <div className="flex min-w-0 items-center gap-3">
                  <div className="mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-[22px] bg-[#fff6ee] shadow-[0_10px_22px_rgba(184,113,93,0.12)]">
                    <Heart className="h-7 w-7 fill-[#f39a78] stroke-[#f39a78]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-[2rem] font-semibold leading-none tracking-[0.01em]">Gratitude</h1>
                    <p className="mt-1 text-[0.92rem] text-[#8f7568]">
                      只属于你和我 <span className="text-[#f39a78]">❤</span>
                    </p>
                  </div>
                </div>
                <div className="rounded-full bg-white/70 px-2 py-1 shadow-sm">
                  <AvatarStack />
                </div>
              </div>

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
            </section>

            {todayEntries.length > 0 ? (
              <section className="mt-4 glass-panel rounded-[28px] p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[1.35rem] font-semibold text-ink">今天收到</h3>
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
                  {todayEntries.map((item) => (
                    <div key={item.id} className="rounded-[24px] bg-[#fff6ee] p-3">
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
                    subtitle="马上出现"
                    onClick={() => setDeliveryMode("now")}
                  />
                  <ScheduleCard
                    active={deliveryMode === "scheduled"}
                    icon="🌙"
                    title="定时送达"
                    subtitle={`每天 ${readableDeliveryTime}`}
                    onClick={() => setDeliveryMode("scheduled")}
                  />
                </div>
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

            {todayEntries.length === 0 ? (
              <section className="mt-4 glass-panel rounded-[28px] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-[1.35rem] font-semibold text-ink">今天收到</h3>
                  </div>
                </div>

                <div className="rounded-[24px] bg-[#fff6ee] p-4">
                  <p className="text-sm text-[#8f7568]">今天还没有收到内容。</p>
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
                  <p className="mt-1 text-[0.92rem] text-[#8f7568]">本周回顾与月度回顾</p>
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
              <MemoryCard title="本周回顾" subtitle="周一到周日" emptyText="目前还没有生成周回顾。" />
              <MemoryCard title="月度回顾" subtitle="按月回看" emptyText="目前还没有可阅读的月度回顾。" />
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
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[1.2rem] font-semibold text-ink">{currentRoleLabel || "未识别"}</p>
                    <p className="mt-1 text-sm text-[#8f7568]">{currentUserEmail}</p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-[#fff4ea]">
                  <LogIn className="h-6 w-6 text-[#f39a78]" aria-hidden="true" />
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
                    await handleDeleteEntry(selectedHistoryEntry.id);
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
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[#fffaf4]/96 px-4">
          <div className="flex flex-col items-center text-center">
            <div className="animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-[#fff2e8] p-5 shadow-[0_20px_50px_rgba(244,160,111,0.18)]">
              <Sparkles className="h-12 w-12 text-[#f39a78]" aria-hidden="true" />
            </div>
            <p className="mt-5 text-[1.6rem] font-semibold text-ink">你的爱意已经发送了</p>
            <p className="mt-2 text-sm text-[#8f7568]">悄悄送到对方那里了</p>
          </div>
        </div>
      ) : null}

      {todayFeedbackOverlay ? (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-[#fffaf4]/96 px-4">
          {todayFeedbackOverlay === "seen" ? (
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-28 w-28 rounded-full bg-[#eef4ff] opacity-80 animate-[ping_1.1s_ease-out_infinite]" />
                <div className="absolute h-20 w-20 rounded-full bg-[#fff] shadow-[0_20px_50px_rgba(132,162,214,0.18)] animate-[pulse_0.9s_ease-in-out_infinite]" />
                <span className="relative text-[4rem] leading-none animate-[bounce_0.9s_ease-in-out_infinite]">👀</span>
              </div>
              <p className="mt-5 text-[1.6rem] font-semibold text-ink">你已经看见了</p>
              <p className="mt-2 text-sm text-[#8f7568]">这一刻被认真收到了</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
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
  onDeleteEntry: (entryId: string) => void;
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
    from: (row.author_id === currentUserId ? currentMemberName : partnerMemberName) as GratitudeEntry["from"],
    to: (row.recipient_id === currentUserId ? currentMemberName : partnerMemberName) as GratitudeEntry["to"],
    body: row.body,
    writtenAt: row.created_at,
    deliveredAt: row.delivered_at ?? row.deliver_at,
    state: row.recipient_reaction === "loved" ? "loved" : row.recipient_reaction === "seen" ? "seen" : "new"
  };
}
