import { NextResponse } from "next/server";
import { createSupabaseAnonClient, sendPushToUser } from "@/lib/server/push";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const recipientId = String(body.recipientId ?? "");
    const title = String(body.title ?? "Gratitude");
    const message = String(body.message ?? "你收到了一条新的爱意");
    const url = String(body.url ?? "/");

    if (!recipientId) {
      return NextResponse.json({ error: "缺少接收人" }, { status: 400 });
    }

    const supabase = createSupabaseAnonClient();
    if (!supabase) {
      return NextResponse.json({ error: "缺少推送配置" }, { status: 500 });
    }

    const result = await sendPushToUser({
      recipientId,
      title,
      message,
      url,
      supabaseClient: supabase
    });

    return NextResponse.json({ ok: true, count: result.count, sent: result.sent, failed: result.failed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "推送失败" },
      { status: 500 }
    );
  }
}
