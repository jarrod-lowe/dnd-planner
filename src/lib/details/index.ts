import type { ItemDetail } from './types';
import { get } from 'svelte/store';
import { locale } from '$lib/i18n';

const BASE = '/details';

export const _cache = new Map<string, ItemDetail | null>();
export const _inflight = new Map<string, Promise<ItemDetail | null>>();
const MAX_ENTRIES = 60;

function cacheKey(key: string): string {
  const loc = get(locale) ?? 'en';
  return `${loc}:${key}`;
}

async function fetchDetail(key: string): Promise<ItemDetail | null> {
  const loc = get(locale) ?? 'en';
  let transient = false;
  const tryLoad = async (l: string): Promise<ItemDetail | null> => {
    const res = await fetch(`${BASE}/${l}/${key}.json`);
    if (res.status === 404) return null;
    if (!res.ok) {
      transient = true;
      return null;
    }
    return (await res.json()) as ItemDetail;
  };
  const result = (await tryLoad(loc)) ?? (loc !== 'en' ? await tryLoad('en') : null);
  if (result === null && transient) throw new Error('transient');
  return result;
}

function remember(ck: string, val: ItemDetail | null) {
  _cache.delete(ck);
  _cache.set(ck, val);
  if (_cache.size > MAX_ENTRIES) _cache.delete(_cache.keys().next().value!);
}

export function prefetchDetail(key: string): void {
  const ck = cacheKey(key);
  if (!key || _cache.has(ck) || _inflight.has(ck)) return;
  const p = fetchDetail(key)
    .then((d) => {
      remember(ck, d);
      _inflight.delete(ck);
      return d;
    })
    .catch(() => {
      _inflight.delete(ck);
      return null;
    });
  _inflight.set(ck, p);
}

export async function getDetail(key: string): Promise<ItemDetail | null> {
  const ck = cacheKey(key);
  if (_cache.has(ck)) return _cache.get(ck)!;
  if (_inflight.has(ck)) return _inflight.get(ck)!;
  const p = fetchDetail(key)
    .then((d) => {
      remember(ck, d);
      _inflight.delete(ck);
      return d;
    })
    .catch(() => {
      _inflight.delete(ck);
      return null;
    });
  _inflight.set(ck, p);
  return p;
}

export function peekDetail(key: string): ItemDetail | null | undefined {
  const ck = cacheKey(key);
  return _cache.get(ck);
}

export function clearCache(): void {
  _cache.clear();
  _inflight.clear();
}
