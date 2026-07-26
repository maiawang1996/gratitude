import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function getPushConfig() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@example.com";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey
  };
}

export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getPushConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function createSupabaseAnonClient() {
  const { supabaseUrl, supabaseAnonKey } = getPushConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function ensureWebPushConfigured() {
  const { vapidPublicKey, vapidPrivateKey, vapidSubject } = getPushConfig();
  if (!vapidPublicKey || !vapidPrivateKey) return false;

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return true;
}

export async function sendPushToUser({
  recipientId,
  title,
  message,
  url,
  supabaseClient
}: {
  recipientId: string;
  title: string;
  message: string;
  url: string;
  supabaseClient: ReturnType<typeof createSupabaseAdminClient> | ReturnType<typeof createSupabaseAnonClient>;
}) {
  if (!supabaseClient) {
    throw new Error("缺少 Supabase 配置");
  }

  if (!ensureWebPushConfigured()) {
    throw new Error("缺少推送密钥");
  }

  const { data: subscriptionsRaw, error: subscriptionError } = await supabaseClient.rpc(
    "get_push_subscriptions_for_user",
    { target_user_id: recipientId }
  );

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  const subscriptions = (subscriptionsRaw ?? []) as PushSubscriptionRow[];
  const payload = JSON.stringify({ title, body: message, url });

  await Promise.allSettled(
    subscriptions.map((item) =>
      webpush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth }
        },
        payload
      )
    )
  );

  return { count: subscriptions.length };
}
