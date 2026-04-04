import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const STEPS = [
  {
    title: 'Welcome to Elibri FX',
    description: 'Build trading strategies visually by connecting nodes. Each node is like a neuron — it processes signals and passes them along.',
    icon: '🧠',
  },
  {
    title: 'Drag & Connect Nodes',
    description: 'Drag nodes from the left sidebar onto the canvas. Connect them by dragging from one handle to another. The flow goes left → right.',
    icon: '🔗',
  },
  {
    title: 'Adjust Node Weights',
    description: 'Every node has a weight slider (W). Higher weight = more influence on the final signal. Think of it as importance.',
    icon: '⚖️',
  },
  {
    title: 'See Live Analysis',
    description: 'The right panel shows real-time analysis. Graph Score updates as you change weights and connections. Try switching between Beginner, Pro, and YOLO modes.',
    icon: '📊',
  },
  {
    title: 'Try a Template',
    description: 'Click "Safe Start", "News Sniper", or "YOLO Mode" in the toolbar to load a pre-built strategy. Then customize it!',
    icon: '🚀',
  },
];

const STORAGE_KEY = 'elibri-onboarding-done';

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  const close = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  if (!show) return null;

  const s = STEPS[step];

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ zIndex: 10001 }}>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d0d14] shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? 'bg-indigo-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center">
          <div className="text-4xl mb-4">{s.icon}</div>
          <h2 className="text-lg font-bold text-white mb-2">{s.title}</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{s.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={close}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Skip tutorial
          </button>
          <button
            onClick={next}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            {step < STEPS.length - 1 ? (
              <>Next <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Get Started <Sparkles className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
