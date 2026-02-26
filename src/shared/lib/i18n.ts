import { defaultLocale } from "../../../i8n/config";

type Messages = Record<string, any>;

function isObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value);
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
      defaultMessages = (await import(`../../../messages/lv.json`)).default;
    } catch (err) {
      defaultMessages = {};
    }
  }

  return mergeWithFallback(primary || {}, defaultMessages || {});
}
