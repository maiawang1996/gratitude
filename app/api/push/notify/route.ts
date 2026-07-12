import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

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

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@example.com";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "缺少推送密钥" }, { status: 500 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: subscriptionsRaw, error: subscriptionError } = await supabase.rpc(
      "get_push_subscriptions_for_user",
      { target_user_id: recipientId }
    );

    const subscriptions = (subscriptionsRaw ?? []) as PushSubscriptionRow[];

    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
    }

    const payload = JSON.stringify({ title, body: message, url });
    const settled = await Promise.allSettled(
      (subscriptions ?? []).map((item) =>
        webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: { p256dh: item.p256dh, auth: item.auth }
          },
          payload
        )
      )
    );

    const staleEndpoints: string[] = [];
    for (const result of settled) {
      if (result.status === "rejected") {
        const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
        const endpoint = (result.reason as { endpoint?: string } | undefined)?.endpoint;
        if (statusCode === 410 && endpoint) {
          staleEndpoints.push(endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, count: subscriptions?.length ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "推送失败" },
      { status: 500 }
    );
  }
}
