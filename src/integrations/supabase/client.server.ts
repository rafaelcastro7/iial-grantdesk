import { createClient } from "@supabase/supabase-js";
export * from "./types"; // Types should be exported independently

/**
 * 🌍 ENVIRONMENT SENSOR 🌍
 * Automatically detects whether the app is running in Local (Dev) or Cloud (Lovable).
 */
export function getEnvStatus() {
  // A reliable way: if VITE_SUPABASE_URL contains 'supabase.co', we are in the cloud.
  // If it contains 'localhost', we are local.
  const isCloud = process.env.VITE_SUPABASE_URL?.includes("supabase.co") || false;
  const isDev = process.env.NODE_ENV === "development";

  return {
    isCloud,
    isLocal: !isCloud,
    mode: isDev ? "development" : "production",
    supabaseUrl: process.env.VITE_SUPABASE_URL || "http://localhost:15435",
  };
}

const envStatus = getEnvStatus();

// Log to help debugging
console.log(`\n======================================================`);
console.log(`🚀 IIAL GRANTS - SYSTEM TELEMETRY STARTED`);
console.log(`======================================================`);
console.log(`📍 Environment:  ${envStatus.isCloud ? "☁️ Lovable Cloud" : "💻 Local Machine"}`);
console.log(`📦 Node Mode:    ${envStatus.mode}`);
console.log(`🗄️  Supabase URL: ${envStatus.supabaseUrl}`);
console.log(`🧠 Cloud LLM:    ${process.env.GROQ_API_KEY ? "✅ Groq Ready" : "❌ Groq Missing"}`);
console.log(`======================================================\n`);

// Dynamic Supabase Admin
const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://qcuzwryknrniujjfvvvr.supabase.co";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const isBrokenDummyKey =
  !rawServiceKey || rawServiceKey.includes(".o6YD5ulurS5oZihQYqKP5NefZpJBgFEe0idYY3gBQa8");
const serviceKey = isBrokenDummyKey
  ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ""
  : rawServiceKey;

if (isBrokenDummyKey) {
  // In production a missing service key must fail loudly: with the publishable
  // key every admin write is silently rejected by RLS and data looks saved
  // when it is not. Local development may fall back for read-only scripts.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing or invalid in production: admin writes will be rejected by RLS.",
    );
  }
  console.warn(
    "⚠️ [Telemetry] SUPABASE_SERVICE_ROLE_KEY is invalid/missing. Falling back to publishable key (local only).",
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
