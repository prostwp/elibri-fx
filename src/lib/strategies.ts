import { supabase } from './supabase';
import type { Node, Edge } from '@xyflow/react';
import type { SegmentMode } from '../types/nodes';

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
}

export async function fetchStrategies(): Promise<Strategy[]> {
  // Timeout after 5 seconds
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const { data, error } = await supabase
      .from('strategies')
      .select('*')
      .order('updated_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (error) {
      console.error('fetchStrategies error:', error);
      return [];
    }
    return (data ?? []) as Strategy[];
  } catch (err) {
    clearTimeout(timeout);
    console.error('fetchStrategies timeout/error:', err);
    return [];
  }
}

export async function fetchStrategy(id: string): Promise<Strategy | null> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Strategy;
}

export async function createStrategy(
  userId: string,
  name: string,
  nodes: Node[],
  edges: Edge[],
  segment: SegmentMode,
  selectedPair: string,
): Promise<Strategy> {
  const { data, error } = await supabase
    .from('strategies')
    .insert({
      user_id: userId,
      name,
      nodes_json: nodes,
      edges_json: edges,
      segment,
      selected_pair: selectedPair,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Strategy;
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
  const { error } = await supabase
    .from('strategies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteStrategy(id: string): Promise<void> {
  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateStrategy(id: string, userId: string): Promise<Strategy> {
  const original = await fetchStrategy(id);
  if (!original) throw new Error('Strategy not found');

  return createStrategy(
    userId,
    `${original.name} (copy)`,
    original.nodes_json,
    original.edges_json,
    original.segment as SegmentMode,
    original.selected_pair,
  );
}
