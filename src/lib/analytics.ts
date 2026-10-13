export type AnalyticsPage = "lab" | "inspiration" | "finder" | "my" | "admin";

export type AnalyticsEventInput = {
  eventName: string;
  page: AnalyticsPage;
  action: string;
  target?: string;
  recipeId?: string;
  ingredientIds?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
};

export type AnalyticsEventRecord = AnalyticsEventInput & {
  id: string;
  sessionId: string;
  createdAt: string;
};

const STORAGE_KEY = "alchemix_analytics_events";
const SESSION_KEY = "alchemix_session_id";
const MAX_LOCAL_EVENTS = 500;

const getSessionId = () => {
  if (typeof window === "undefined") return "server";
  let existing: string|null=null;
  try { existing = window.localStorage.getItem(SESSION_KEY); } catch {}
  if (existing) return existing;
  const next = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try { window.localStorage.setItem(SESSION_KEY, next); } catch {}
  return next;
};

export const readAnalyticsEvents = (): AnalyticsEventRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const trackAnalyticsEvent = (event: AnalyticsEventInput) => {
  if (typeof window === "undefined") return;

  const record: AnalyticsEventRecord = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: getSessionId(),
    createdAt: new Date().toISOString(),
  };

  const next = [record, ...readAnalyticsEvents()].slice(0, MAX_LOCAL_EVENTS);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}

  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
    keepalive: true,
  }).catch(() => {
    // 本地 demo 阶段允许数据库未连接，管理页仍可读取 localStorage 指标。
  });
};
