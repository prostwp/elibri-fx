import { useState, useCallback } from 'react';
import { useFlowStore } from '../../stores/useFlowStore';
import {
  createBlueprint,
  generateAllCode,
  type NodeBlueprint,
  type RuleBlueprint,
  type SettingBlueprint,
} from '../../lib/nodeCodegen';

const ICONS = ['📊', '🎯', '⚡', '🧠', '🔮', '💎', '🚀', '🛡️', '🔥', '📈', '📉', '🎲', '🏆', '⭐', '💡', '🔔', '📰', '🏦', '🎓', '💰'];

const RULE_TYPES = [
  { value: 'indicator', label: 'Indicator', icon: '📈' },
  { value: 'news', label: 'News', icon: '📰' },
  { value: 'price', label: 'Price Action', icon: '💰' },
  { value: 'time', label: 'Time', icon: '⏰' },
  { value: 'custom', label: 'Custom', icon: '⚡' },
];

const INDICATORS = ['RSI', 'MACD', 'Bollinger Bands', 'EMA', 'SMA', 'ATR', 'Stochastic', 'VWAP', 'ADX', 'CCI'];
const OPERATORS = ['>', '<', '>=', '<=', '=', 'crosses above', 'crosses below'];
const NEWS_FILTERS = ['NFP', 'FOMC', 'CPI', 'ECB', 'BOJ', 'GDP', 'PMI', 'Any High Impact', 'Any Medium Impact'];
const PRICE_ACTIONS = ['Breakout above', 'Breakout below', 'Bounce off support', 'Rejection at resistance', 'New high', 'New low', 'Inside bar', 'Engulfing candle'];
const TIME_FILTERS = ['London session', 'NY session', 'Asian session', 'Overlap LDN-NY', 'First 30 min', 'Last hour', 'Avoid news ±30min'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NodeConstructor({ isOpen, onClose }: Props) {
  const addNode = useFlowStore(s => s.addNode);
  const nodes = useFlowStore(s => s.nodes);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [category, setCategory] = useState<NodeBlueprint['category']>('logic');
  const [description, setDescription] = useState('');
  const [premium, setPremium] = useState(false);
  const [inputs, setInputs] = useState<string[]>(['signals']);
  const [outputs, setOutputs] = useState<string[]>(['trigger']);
  const [rules, setRules] = useState<RuleBlueprint[]>([]);
  const [settings, setSettings] = useState<SettingBlueprint[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [step, setStep] = useState(1); // 1=Identity, 2=Rules, 3=Settings, 4=Code
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const blueprint = createBlueprint({ name, icon, category, description, premium, inputs, outputs, rules, settings });
  const generated = generateAllCode(blueprint);

  // ─── Rules ──────────────────────
  const addRule = useCallback((type: RuleBlueprint['type']) => {
    const rule: RuleBlueprint = { id: `r-${Date.now()}`, type, label: '' };
    if (type === 'indicator') { rule.indicator = 'RSI'; rule.operator = '>'; rule.value = '70'; rule.label = 'RSI > 70'; }
    else if (type === 'news') { rule.value = 'Any High Impact'; rule.label = 'Any High Impact'; }
    else if (type === 'price') { rule.value = 'Breakout above'; rule.label = 'Breakout above'; }
    else if (type === 'time') { rule.value = 'London session'; rule.label = 'London session'; }
    else { rule.label = 'Custom rule'; }
    setRules(prev => [...prev, rule]);
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<RuleBlueprint>) => {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, ...updates };
      if (u.type === 'indicator') u.label = `${u.indicator} ${u.operator} ${u.value}`;
      else if (['news', 'price', 'time'].includes(u.type)) u.label = u.value || '';
      return u;
    }));
  }, []);

  // ─── Settings ──────────────────────
  const addSetting = useCallback(() => {
    setSettings(prev => [...prev, {
      id: `s-${Date.now()}`,
      key: `setting${prev.length + 1}`,
      label: '',
      type: 'select',
      options: ['Option 1', 'Option 2'],
      defaultValue: 'Option 1',
    }]);
  }, []);

  // ─── Copy ──────────────────────
  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // ─── Add to canvas ──────────────────────
  const addToCanvas = useCallback(() => {
    const offsetX = 300 + (nodes.length % 4) * 50;
    const offsetY = 200 + Math.floor(nodes.length / 4) * 80;
    addNode({
      id: `custom-${Date.now()}`,
      type: 'customNode',
      position: { x: offsetX, y: offsetY },
      data: { name, icon, category, description, rules, settings },
    });
    onClose();
  }, [name, icon, category, description, rules, settings, addNode, nodes.length, onClose]);

  // ─── Reset ──────────────────────
  const reset = () => {
    setName(''); setIcon('⚡'); setCategory('logic'); setDescription('');
    setPremium(false); setInputs(['signals']); setOutputs(['trigger']);
    setRules([]); setSettings([]); setStep(1);
  };

  if (!isOpen) return null;

  const STEPS = ['Identity', 'Rules', 'Settings', 'Code'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[580px] max-h-[88vh] bg-[#0f0f17] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wider">Admin</span>
              <h2 className="text-sm font-bold text-white">Node Designer</h2>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">Design → Generate Code → Ship</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1">Reset</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">✕</button>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 flex gap-1 border-b border-white/5">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i + 1)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                step === i + 1 ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ─── Step 1: Identity ─── */}
          {step === 1 && (
            <>
              <div className="flex gap-3">
                <div className="relative">
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 flex items-center justify-center text-2xl transition-all"
                  >{icon}</button>
                  {showIconPicker && (
                    <div className="absolute top-14 left-0 z-10 bg-[#1a1a24] border border-white/10 rounded-xl p-2 grid grid-cols-5 gap-1 shadow-xl">
                      {ICONS.map(ic => (
                        <button key={ic} onClick={() => { setIcon(ic); setShowIconPicker(false); }}
                          className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg">{ic}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Node name (e.g. Momentum Filter)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500/50 placeholder-gray-600" autoFocus />
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-[11px] outline-none focus:border-indigo-500/50 placeholder-gray-600" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Category</label>
                <div className="flex gap-2">
                  {(['source', 'analysis', 'logic', 'agent', 'output'] as const).map(cat => {
                    const colors: Record<string, string> = { source: 'blue', analysis: 'emerald', logic: 'amber', agent: 'purple', output: 'red' };
                    const c = colors[cat];
                    return (
                      <button key={cat} onClick={() => setCategory(cat)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-all capitalize ${
                          category === cat ? `bg-${c}-500/15 border-${c}-500/30 text-${c}-400` : 'bg-white/[0.02] border-white/5 text-gray-600'
                        }`}
                        style={category === cat ? { backgroundColor: `color-mix(in srgb, ${c === 'blue' ? '#3b82f6' : c === 'emerald' ? '#10b981' : c === 'amber' ? '#f59e0b' : c === 'purple' ? '#a855f7' : '#ef4444'} 10%, transparent)`,
                          borderColor: `color-mix(in srgb, ${c === 'blue' ? '#3b82f6' : c === 'emerald' ? '#10b981' : c === 'amber' ? '#f59e0b' : c === 'purple' ? '#a855f7' : '#ef4444'} 30%, transparent)`,
                          color: c === 'blue' ? '#60a5fa' : c === 'emerald' ? '#34d399' : c === 'amber' ? '#fbbf24' : c === 'purple' ? '#c084fc' : '#f87171' } : {}}
                      >{cat}</button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Inputs</label>
                  <div className="flex flex-wrap gap-1">
                    {['signals', 'candles', 'news', 'events', 'patterns', 'market'].map(inp => (
                      <button key={inp} onClick={() => setInputs(prev => prev.includes(inp) ? prev.filter(i => i !== inp) : [...prev, inp])}
                        className={`text-[9px] px-2 py-1 rounded-md border transition-all ${inputs.includes(inp) ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/[0.02] border-white/5 text-gray-600'}`}
                      >{inp}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Outputs</label>
                  <div className="flex flex-wrap gap-1">
                    {['trigger', 'signals', 'analysis', 'combined', 'data'].map(out => (
                      <button key={out} onClick={() => setOutputs(prev => prev.includes(out) ? prev.filter(o => o !== out) : [...prev, out])}
                        className={`text-[9px] px-2 py-1 rounded-md border transition-all ${outputs.includes(out) ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/[0.02] border-white/5 text-gray-600'}`}
                      >{out}</button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={premium} onChange={e => setPremium(e.target.checked)} className="rounded" />
                <span className="text-[10px] text-gray-400">Premium node (PRO badge)</span>
              </label>
            </>
          )}

          {/* ─── Step 2: Rules ─── */}
          {step === 2 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {RULE_TYPES.map(rt => (
                  <button key={rt.value} onClick={() => addRule(rt.value as RuleBlueprint['type'])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-indigo-400 transition-all text-[10px] font-medium">
                    <span>{rt.icon}</span>{rt.label}
                  </button>
                ))}
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-gray-600">No rules yet. Add rules above.</div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-600">{idx + 1}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase font-bold">{rule.type}</span>
                        </div>
                        <button onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))} className="text-[10px] text-gray-600 hover:text-red-400">✕</button>
                      </div>
                      {rule.type === 'indicator' && (
                        <div className="flex gap-2">
                          <select value={rule.indicator} onChange={e => updateRule(rule.id, { indicator: e.target.value })}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                            {INDICATORS.map(i => <option key={i} value={i} className="bg-gray-900">{i}</option>)}
                          </select>
                          <select value={rule.operator} onChange={e => updateRule(rule.id, { operator: e.target.value })}
                            className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                            {OPERATORS.map(o => <option key={o} value={o} className="bg-gray-900">{o}</option>)}
                          </select>
                          <input type="text" value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                            className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none text-center" />
                        </div>
                      )}
                      {rule.type === 'news' && (
                        <select value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                          {NEWS_FILTERS.map(n => <option key={n} value={n} className="bg-gray-900">{n}</option>)}
                        </select>
                      )}
                      {rule.type === 'price' && (
                        <select value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                          {PRICE_ACTIONS.map(p => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
                        </select>
                      )}
                      {rule.type === 'time' && (
                        <select value={rule.value} onChange={e => updateRule(rule.id, { value: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                          {TIME_FILTERS.map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}
                        </select>
                      )}
                      {rule.type === 'custom' && (
                        <input type="text" value={rule.label} onChange={e => updateRule(rule.id, { label: e.target.value })}
                          placeholder="Describe rule..." className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none placeholder-gray-600" />
                      )}
                      <div className="text-[9px] text-gray-500">→ <span className="text-indigo-400">{rule.label}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Step 3: Settings ─── */}
          {step === 3 && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">User-configurable settings</label>
                <button onClick={addSetting} className="text-[10px] px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all font-medium">+ Add Setting</button>
              </div>

              {settings.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-gray-600">No settings. The node will have fixed behavior.</div>
              ) : (
                <div className="space-y-2">
                  {settings.map((s, idx) => (
                    <div key={s.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500">Setting {idx + 1}</span>
                        <button onClick={() => setSettings(prev => prev.filter(x => x.id !== s.id))} className="text-[10px] text-gray-600 hover:text-red-400">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={s.key} onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, key: e.target.value } : x))}
                          placeholder="key" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none font-mono" />
                        <input value={s.label} onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, label: e.target.value } : x))}
                          placeholder="Label" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <select value={s.type} onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, type: e.target.value as any } : x))}
                          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none">
                          <option value="select" className="bg-gray-900">Select</option>
                          <option value="number" className="bg-gray-900">Number</option>
                          <option value="text" className="bg-gray-900">Text</option>
                          <option value="toggle" className="bg-gray-900">Toggle</option>
                        </select>
                        <input value={s.defaultValue} onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, defaultValue: e.target.value } : x))}
                          placeholder="Default" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none" />
                      </div>
                      {s.type === 'select' && (
                        <input value={s.options?.join(', ')} onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, options: e.target.value.split(',').map(o => o.trim()) } : x))}
                          placeholder="Options (comma-separated)" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-[10px] outline-none placeholder-gray-600" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Step 4: Generated Code ─── */}
          {step === 4 && (
            <>
              {/* Preview */}
              <div className="flex justify-center py-3">
                <NodePreview bp={blueprint} />
              </div>

              {/* Component Code */}
              <CodeBlock title={`Component — ${generated.filename}`} code={generated.component}
                copied={copiedField === 'component'} onCopy={() => copyToClipboard(generated.component, 'component')} />

              {/* Definition */}
              <CodeBlock title="nodeDefinitions.ts — add entry" code={generated.definition}
                copied={copiedField === 'definition'} onCopy={() => copyToClipboard(generated.definition, 'definition')} />

              {/* Registration */}
              <CodeBlock title="index.ts — registration" code={generated.registration}
                copied={copiedField === 'registration'} onCopy={() => copyToClipboard(generated.registration, 'registration')} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
          <button onClick={() => setStep(Math.max(1, step - 1))}
            className={`px-4 py-2 rounded-lg text-[11px] font-medium transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            Back
          </button>
          <div className="flex gap-2">
            {step < 4 ? (
              <button onClick={() => setStep(step + 1)} disabled={!name.trim()}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                Next
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={addToCanvas}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-medium transition-all">
                  Preview on Canvas
                </button>
                <button onClick={() => copyToClipboard(generated.component, 'all')}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all">
                  {copiedField === 'all' ? 'Copied!' : 'Copy All Code'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Code Block ──────────────────────

function CodeBlock({ title, code, copied, onCopy }: { title: string; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/5">
        <span className="text-[10px] font-semibold text-gray-400">{title}</span>
        <button onClick={onCopy}
          className={`text-[10px] px-2 py-0.5 rounded transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-[10px] text-gray-400 overflow-x-auto max-h-[200px] overflow-y-auto leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Node Preview ──────────────────────

function NodePreview({ bp }: { bp: NodeBlueprint }) {
  const colorMap: Record<string, string> = {
    source: '#3b82f6', analysis: '#10b981', logic: '#f59e0b', agent: '#a855f7', output: '#ef4444',
  };
  const color = colorMap[bp.category] ?? '#6366f1';

  return (
    <div className="rounded-xl border min-w-[220px] max-w-[260px]"
      style={{ borderColor: `${color}30`, background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <span className="text-base">{bp.icon}</span>
        <span className="text-xs font-semibold text-white/90 flex-1">{bp.name || 'Untitled'}</span>
        {bp.premium && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">PRO</span>}
      </div>
      <div className="px-3 py-2 space-y-1">
        {bp.description && <p className="text-[9px] text-gray-500">{bp.description}</p>}
        {bp.rules.map(r => (
          <div key={r.id} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-400">{r.label}</span>
          </div>
        ))}
        {bp.settings.map(s => (
          <div key={s.id} className="text-[9px] text-gray-600">[{s.type}] {s.label}: {s.defaultValue}</div>
        ))}
        <div className="flex flex-wrap gap-1 pt-1">
          {bp.inputs.map(i => <span key={i} className="text-[8px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">← {i}</span>)}
          {bp.outputs.map(o => <span key={o} className="text-[8px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">{o} →</span>)}
        </div>
      </div>
    </div>
  );
}
