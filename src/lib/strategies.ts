import type { Node, Edge } from '@xyflow/react';
import type { SegmentMode } from '../types/nodes';
import { authHeaders } from './authClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080';

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  nodes_json: Node[];
  edges_json: Edge[];
  segment: SegmentMode;
  selected_pair: string;
  created_at: string;
  updated_at: string;
  // Patch 2C + Patch 3 fields (may be missing in older responses).
  is_active?: boolean;
  interval?: string;          // "5m" | "15m" | "1h" | "4h" | "1d"
  risk_tier?: 'conservative' | 'balanced' | 'aggressive';
  telegram_enabled?: boolean;
  auto_execute?: boolean;
  last_signal_bar_time?: number | null;
  last_signal_direction?: 'buy' | 'sell' | null;
  paused_until?: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init.headers ?? {}),
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const data = await request<{ strategies: Strategy[] }>('/strategies', { method: 'GET' });
  return data?.strategies ?? [];
}

export async function fetchStrategy(id: string): Promise<Strategy | null> {
  return request<Strategy>(`/strategies/${id}`, { method: 'GET' });
}

export async function createStrategy(
  _userId: string,
  name: string,
  nodes: Node[],
  edges: Edge[],
  segment: SegmentMode,
  selectedPair: string,
): Promise<Strategy> {
  const result = await request<Strategy>('/strategies', {
    method: 'POST',
    body: JSON.stringify({
      name,
      nodes_json: nodes,
      edges_json: edges,
      segment,
      selected_pair: selectedPair,
    }),
  });
  if (!result) throw new Error('Failed to create strategy');
  return result;
}

export async function updateStrategy(
  id: string,
  updates: {
    name?: string;
    nodes_json?: Node[];
    edges_json?: Edge[];
    segment?: SegmentMode;
    selected_pair?: string;
  },
): Promise<void> {
  // Fetch existing to merge partial updates (backend expects full record).
  const existing = await fetchStrategy(id);
  if (!existing) throw new Error('Strategy not found');

  const merged = {
    name: updates.name ?? existing.name,
    nodes_json: updates.nodes_json ?? existing.nodes_json,
    edges_json: updates.edges_json ?? existing.edges_json,
    segment: updates.segment ?? existing.segment,
    selected_pair: updates.selected_pair ?? existing.selected_pair,
  };
  const result = await request<Strategy>(`/strategies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(merged),
  });
  if (!result) throw new Error('Failed to update strategy');
}

export async function deleteStrategy(id: string): Promise<void> {
  const result = await request<{ status: string }>(`/strategies/${id}`, { method: 'DELETE' });
  if (!result) throw new Error('Failed to delete strategy');
}

export async function duplicateStrategy(id: string, userId: string): Promise<Strategy> {
  const original = await fetchStrategy(id);
  if (!original) throw new Error('Strategy not found');

  return createStrategy(
    userId,
    `${original.name} (copy)`,
    original.nodes_json,
    original.edges_json,
    original.segment,
    original.selected_pair,
  );
}
