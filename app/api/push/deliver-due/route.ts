import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  ensureWebPushConfigured,
  getPushConfig,
  sendPushToUser
} from "@/lib/server/push";

type ScheduledEntryRow = {
  id: string;
  recipient_id: string;
  kind: "thank_you" | "noticed";
  body: string;
  deliver_at: string;
  delivered_at: string | null;
};

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

async function handleDelivery(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { supabaseUrl, supabaseServiceRoleKey } = getPushConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "缺少服务端 Supabase 配置" }, { status: 500 });
  }

  if (!ensureWebPushConfigured()) {
    return NextResponse.json({ error: "缺少推送密钥" }, { status: 500 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 管理端初始化失败" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("gratitude_entries")
    .select("id, recipient_id, kind, body, deliver_at, delivered_at")
    .is("delivered_at", null)
    .lte("deliver_at", now)
    .order("deliver_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueEntries = (data ?? []) as ScheduledEntryRow[];
  if (dueEntries.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0 });
  }

  let sent = 0;
  const deliveredIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const entry of dueEntries) {
    try {
      await sendPushToUser({
        recipientId: entry.recipient_id,
        title: entry.kind === "thank_you" ? "收到一条谢谢你" : "收到一条我看见了",
        message: entry.body,
        url: "/",
        supabaseClient: supabase
      });
      deliveredIds.push(entry.id);
      sent += 1;
    } catch (sendError) {
      failures.push({
        id: entry.id,
        error: sendError instanceof Error ? sendError.message : "推送失败"
      });
    }
  }

  if (deliveredIds.length > 0) {
    const { error: updateError } = await supabase
      .from("gratitude_entries")
      .update({ delivered_at: now })
      .in("id", deliveredIds);

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
          processed: dueEntries.length,
          sent,
          failures
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    processed: dueEntries.length,
    sent,
    failures
  });
}

export async function GET(request: Request) {
  return handleDelivery(request);
}

export async function POST(request: Request) {
  return handleDelivery(request);
}
