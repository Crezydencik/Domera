import { defaultLocale } from "../../../i8n/config";

export type Messages = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeMessages(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMessages);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.includes('.'))
        .map(([key, nestedValue]) => [key, sanitizeMessages(nestedValue)])
    );
  }

  return value;
}

// Deep-merge: take primary messages, and where keys are missing use fallback
export function mergeWithFallback(primary: Messages, fallback: Messages): Messages {
  const result: Messages = { ...fallback };

  for (const key of Object.keys(primary || {})) {
    const p = primary[key];
    const f = fallback ? fallback[key] : undefined;

    if (isObject(p) && isObject(f)) {
      result[key] = mergeWithFallback(p, f as Messages);
    } else if (p === undefined) {
      result[key] = f;
    } else {
      result[key] = p;
    }
  }

  return result;
}

export async function messagesWithDefault(primary: Messages, _locale?: string) {
  // Always use configured defaultLocale as the fallback source of truth
  let defaultMessages: Messages = {};
  try {
    defaultMessages = (await import(`../../../messages/${defaultLocale}.json`)).default;
  } catch (e) {
    // If configured default missing, try English then empty
    try {
      defaultMessages = (await import(`../../../messages/lv.json`)).default as Messages;
    } catch (err) {
      defaultMessages = {};
    }
  }

  return mergeWithFallback(
    sanitizeMessages(primary || {}) as Messages,
    sanitizeMessages(defaultMessages || {}) as Messages
  );
}
