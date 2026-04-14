import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { NodeSidebar } from '../editor/NodeSidebar';
import { Canvas } from '../editor/Canvas';
import { Toolbar } from '../editor/Toolbar';
import { PreviewPanel } from '../preview/PreviewPanel';
import { MT5ConnectModal } from '../editor/MT5ConnectModal';
import { BinanceConnectModal } from '../editor/BinanceConnectModal';
import { ToastContainer, toast } from '../ui/Toast';
import { Onboarding } from '../ui/Onboarding';
import { useFlowStore } from '../../stores/useFlowStore';

export function AppLayout() {
  const { saveCurrentStrategy, currentStrategyId, dirty } = useFlowStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S → Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentStrategyId && dirty) {
          saveCurrentStrategy().then(() => {
            toast.success('Strategy saved');
          });
        } else if (!currentStrategyId) {
          toast.info('Save a strategy first via Strategies panel');
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStrategyId, dirty, saveCurrentStrategy]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen bg-[#0a0a0f] overflow-hidden">
        <NodeSidebar />
        <div className="flex-1 relative">
          <Toolbar />
          <Canvas />
        </div>
        <PreviewPanel />
        <MT5ConnectModal />
        <BinanceConnectModal />
      </div>
      <ToastContainer />
      <Onboarding />
    </ReactFlowProvider>
  );
}
