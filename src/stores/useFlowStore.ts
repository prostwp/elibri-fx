import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { SegmentMode } from '../types/nodes';
import { updateStrategy } from '../lib/strategies';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedPair: string;
  previewOpen: boolean;
  segmentMode: SegmentMode;

  // Strategy persistence
  currentStrategyId: string | null;
  currentStrategyName: string;
  dirty: boolean;
  saving: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setSelectedPair: (pair: string) => void;
  setPreviewOpen: (open: boolean) => void;
  setSegmentMode: (mode: SegmentMode) => void;
  clear: () => void;

  // Strategy actions
  setCurrentStrategy: (id: string | null, name: string) => void;
  setStrategyName: (name: string) => void;
  markDirty: () => void;
  saveCurrentStrategy: () => Promise<void>;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => FlowState) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const state = get();
    if (state.currentStrategyId && state.dirty) {
      state.saveCurrentStrategy();
    }
  }, 30000);
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedPair: 'EURUSD',
  previewOpen: true,
  segmentMode: 'pro',

  currentStrategyId: null,
  currentStrategyName: 'Untitled Strategy',
  dirty: false,
  saving: false,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes), dirty: true });
    scheduleAutosave(get);
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges), dirty: true });
    scheduleAutosave(get);
  },

  onConnect: (connection) => {
    const edge: Edge = {
      id: `e-${connection.source}-${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    };
    set({ edges: [...get().edges, edge], dirty: true });
    scheduleAutosave(get);
  },

  addNode: (node) => {
    // Inject per-type default data (merged under existing data, so caller-supplied
    // values win). Currently only RiskManager needs a default riskTier so its
    // tier-aware sizing works on the very first render. Covers both drag-from-
    // sidebar and programmatic spawns.
    const typeDefaults: Record<string, Record<string, unknown>> = {
      riskManager: { riskTier: 'balanced' },
    };
    const extra = node.type ? typeDefaults[node.type] : undefined;
    const enriched = extra
      ? { ...node, data: { ...extra, ...(node.data ?? {}) } }
      : node;
    set({ nodes: [...get().nodes, enriched], dirty: true });
    scheduleAutosave(get);
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      dirty: true,
    });
    scheduleAutosave(get);
  },

  setSelectedPair: (pair) => {
    set({ selectedPair: pair, dirty: true });
    scheduleAutosave(get);
  },
  setPreviewOpen: (open) => set({ previewOpen: open }),
  setSegmentMode: (mode) => {
    set({ segmentMode: mode, dirty: true });
    scheduleAutosave(get);
  },

  clear: () => set({
    nodes: [],
    edges: [],
    currentStrategyId: null,
    currentStrategyName: 'Untitled Strategy',
    dirty: false,
  }),

  setCurrentStrategy: (id, name) => set({
    currentStrategyId: id,
    currentStrategyName: name,
    dirty: false,
  }),

  setStrategyName: (name) => {
    set({ currentStrategyName: name, dirty: true });
    scheduleAutosave(get);
  },

  markDirty: () => {
    set({ dirty: true });
    scheduleAutosave(get);
  },

  saveCurrentStrategy: async () => {
    const { currentStrategyId, nodes, edges, segmentMode, selectedPair, currentStrategyName } = get();
    if (!currentStrategyId) return;

    set({ saving: true });
    try {
      await updateStrategy(currentStrategyId, {
        name: currentStrategyName,
        nodes_json: nodes,
        edges_json: edges,
        segment: segmentMode,
        selected_pair: selectedPair,
      });
      set({ dirty: false });
    } catch (err) {
      console.error('Autosave failed:', err);
    } finally {
      set({ saving: false });
    }
  },
}));
