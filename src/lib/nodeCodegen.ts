// Node Code Generator — generates TypeScript source code for custom nodes

export interface NodeBlueprint {
  name: string;
  icon: string;
  category: 'source' | 'analysis' | 'logic' | 'agent' | 'output';
  description: string;
  componentName: string; // PascalCase
  typeName: string;      // camelCase for nodeTypes registry
  premium: boolean;
  inputs: string[];
  outputs: string[];
  rules: RuleBlueprint[];
  settings: SettingBlueprint[];
}

export interface RuleBlueprint {
  id: string;
  type: 'indicator' | 'news' | 'price' | 'time' | 'custom';
  label: string;
  indicator?: string;
  operator?: string;
  value?: string;
}

export interface SettingBlueprint {
  id: string;
  key: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'toggle';
  options?: string[];
  defaultValue: string;
}

function toPascalCase(str: string): string {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').replace(/(?:^|\s)\S/g, a => a.toUpperCase()).replace(/\s/g, '');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function createBlueprint(partial: Partial<NodeBlueprint> & { name: string }): NodeBlueprint {
  return {
    icon: '⚡',
    category: 'logic',
    description: '',
    premium: false,
    inputs: ['signals'],
    outputs: ['trigger'],
    rules: [],
    settings: [],
    ...partial,
    componentName: toPascalCase(partial.name) + 'Node',
    typeName: toCamelCase(partial.name),
  };
}

// ─── Generate Component TSX ──────────────────────

export function generateComponentCode(bp: NodeBlueprint): string {
  const hasSettings = bp.settings.length > 0;
  const imports = hasSettings
    ? `import { BaseNode } from './BaseNode';
import { useFlowStore } from '../../stores/useFlowStore';
import type { NodeProps } from '@xyflow/react';`
    : `import { BaseNode } from './BaseNode';
import type { NodeProps } from '@xyflow/react';`;

  const settingsCode = bp.settings.map(s => {
    if (s.type === 'select') {
      return `
        <div>
          <label className="text-[9px] text-gray-500 block mb-0.5">${s.label}</label>
          <select
            value={(data.${s.key} as string) || '${s.defaultValue}'}
            onChange={(e) => updateNodeData(id, { ${s.key}: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none"
          >
            ${s.options?.map(o => `<option value="${o}" className="bg-gray-900">${o}</option>`).join('\n            ')}
          </select>
        </div>`;
    }
    if (s.type === 'number') {
      return `
        <div className="flex items-center gap-2">
          <label className="text-[9px] text-gray-500 w-16">${s.label}</label>
          <input
            type="number"
            value={(data.${s.key} as number) || ${s.defaultValue}}
            onChange={(e) => updateNodeData(id, { ${s.key}: Number(e.target.value) })}
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none w-16"
          />
        </div>`;
    }
    if (s.type === 'toggle') {
      return `
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!data.${s.key}}
            onChange={(e) => updateNodeData(id, { ${s.key}: e.target.checked })}
            className="rounded"
          />
          <span className="text-[10px] text-gray-400">${s.label}</span>
        </label>`;
    }
    return `
        <div>
          <label className="text-[9px] text-gray-500 block mb-0.5">${s.label}</label>
          <input
            type="text"
            value={(data.${s.key} as string) || '${s.defaultValue}'}
            onChange={(e) => updateNodeData(id, { ${s.key}: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none"
          />
        </div>`;
  }).join('\n');

  const rulesJSX = bp.rules.map(r =>
    `        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded uppercase font-bold">${r.type}</span>
          <span className="text-[10px] text-gray-400">${r.label}</span>
        </div>`
  ).join('\n');

  const tagsJSX = bp.rules.length > 0
    ? `\n        <div className="flex flex-wrap gap-1 pt-0.5">
${bp.rules.map(r => `          <span className="text-[9px] px-1.5 py-0.5 bg-white/5 text-gray-400 rounded">${r.label}</span>`).join('\n')}
        </div>`
    : '';

  const funcParams = hasSettings ? '{ id, data }: NodeProps' : '({ }: NodeProps)';
  const storeHook = hasSettings ? '\n  const updateNodeData = useFlowStore(s => s.updateNodeData);' : '';

  return `${imports}

export function ${bp.componentName}(${funcParams}) {${storeHook}
  return (
    <BaseNode
      icon="${bp.icon}"
      label="${bp.name}"
      category="${bp.category}"
      ${bp.premium ? 'premium' : ''}
      inputs={${bp.inputs.length}}
      outputs={${bp.outputs.length}}
    >
      <div className="space-y-1.5">
${rulesJSX}${settingsCode}${tagsJSX}
      </div>
    </BaseNode>
  );
}
`;
}

// ─── Generate Node Definition ──────────────────────

export function generateDefinitionCode(bp: NodeBlueprint): string {
  const defaultData: Record<string, unknown> = {};
  bp.settings.forEach(s => {
    defaultData[s.key] = s.type === 'number' ? Number(s.defaultValue) : s.defaultValue;
  });

  return `  {
    type: '${bp.typeName}',
    label: '${bp.name}',
    category: '${bp.category}',
    icon: '${bp.icon}',
    description: '${bp.description}',
    premium: ${bp.premium},
    inputs: [${bp.inputs.map(i => `'${i}'`).join(', ')}],
    outputs: [${bp.outputs.map(o => `'${o}'`).join(', ')}],
    defaultData: ${JSON.stringify(defaultData)},
  },`;
}

// ─── Generate Index Registration ──────────────────────

export function generateRegistrationCode(bp: NodeBlueprint): string {
  return `// Add to imports:
import { ${bp.componentName} } from './${bp.componentName.replace('Node', '')}Node';

// Add to nodeTypes:
  ${bp.typeName}: ${bp.componentName} as ComponentType<NodeProps>,`;
}

// ─── Generate All Code ──────────────────────

export function generateAllCode(bp: NodeBlueprint): {
  component: string;
  definition: string;
  registration: string;
  filename: string;
} {
  return {
    component: generateComponentCode(bp),
    definition: generateDefinitionCode(bp),
    registration: generateRegistrationCode(bp),
    filename: `${bp.componentName.replace('Node', '')}Node.tsx`,
  };
}
