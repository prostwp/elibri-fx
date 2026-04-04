import { useCallback } from 'react';
import { NODE_DEFINITIONS, CATEGORY_LABELS } from '../../lib/nodeDefinitions';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeDefinition, NodeCategory } from '../../types/nodes';

const categories: NodeCategory[] = ['source', 'analysis', 'logic', 'agent', 'output'];

export function NodeSidebar() {
  const addNode = useFlowStore(s => s.addNode);
  const nodes = useFlowStore(s => s.nodes);

  const handleAddNode = useCallback((def: NodeDefinition) => {
    const id = `${def.type}-${Date.now()}`;
    const offsetX = 100 + (nodes.length % 4) * 50;
    const offsetY = 100 + Math.floor(nodes.length / 4) * 80;
    addNode({
      id,
      type: def.type,
      position: { x: 250 + offsetX, y: 100 + offsetY },
      data: { ...def.defaultData },
    });
  }, [addNode, nodes.length]);

  const handleDragStart = useCallback((e: React.DragEvent, def: NodeDefinition) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="w-[240px] min-w-[240px] bg-[#0d0d14] border-r border-white/5 flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            E
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Elibri FX</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-widest">Strategy Builder</div>
          </div>
        </div>
      </div>

      {/* Nodes */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {categories.map(cat => {
          const defs = NODE_DEFINITIONS.filter(d => d.category === cat);
          const { label, color } = CATEGORY_LABELS[cat];
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
              </div>
              <div className="space-y-1">
                {defs.map(def => (
                  <button
                    key={def.type}
                    onClick={() => handleAddNode(def)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, def)}
                    className={`
                      w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                      transition-all duration-150 group
                      ${def.premium
                        ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border border-transparent'
                      }
                    `}
                  >
                    <span className="text-sm">{def.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                        {def.label}
                        {def.premium && <span className="text-[8px] font-bold px-1 py-0 rounded bg-amber-500/20 text-amber-400">PRO</span>}
                      </div>
                      <div className="text-[9px] text-gray-600 truncate">{def.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
