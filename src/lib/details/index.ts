import type { ItemDetail } from './types';
import { get } from 'svelte/store';
import { locale } from '$lib/i18n';

const BASE = '/details';

export const _cache = new Map<string, ItemDetail | null>();
export const _inflight = new Map<string, Promise<ItemDetail | null>>();
const MAX_ENTRIES = 60;

async function fetchDetail(key: string): Promise<ItemDetail | null> {
  const loc = get(locale) ?? 'en';
  const tryLoad = async (l: string): Promise<ItemDetail | null> => {
    const res = await fetch(`${BASE}/${l}/${key}.json`);
    if (!res.ok) return null;
    return (await res.json()) as ItemDetail;
  };
  try {
    return (await tryLoad(loc)) ?? (loc !== 'en' ? await tryLoad('en') : null);
  } catch {
    return null;
  }
}

function remember(key: string, val: ItemDetail | null) {
  _cache.delete(key);
  _cache.set(key, val);
  if (_cache.size > MAX_ENTRIES) _cache.delete(_cache.keys().next().value!);
}

export function prefetchDetail(key: string): void {
  if (!key || _cache.has(key) || _inflight.has(key)) return;
  const p = fetchDetail(key).then((d) => {
    remember(key, d);
    _inflight.delete(key);
    return d;
  });
  _inflight.set(key, p);
}

export async function getDetail(key: string): Promise<ItemDetail | null> {
  if (_cache.has(key)) return _cache.get(key)!;
  if (_inflight.has(key)) return _inflight.get(key)!;
  const p = fetchDetail(key).then((d) => {
    remember(key, d);
    _inflight.delete(key);
    return d;
  });
  _inflight.set(key, p);
  return p;
}

export function peekDetail(key: string): ItemDetail | null | undefined {
  return _cache.get(key);
}

export function clearCache(): void {
  _cache.clear();
  _inflight.clear();
}
