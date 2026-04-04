// Embed Stub — for integration into broker's hosting/website
// Will be used to embed the widget as iframe or web component

export interface EmbedConfig {
  brokerId: string;
  theme: 'dark' | 'light';
  allowedPairs: string[];
  defaultPair: string;
  defaultSegment: 'beginner' | 'pro' | 'yolo';
  enableMT5: boolean;
  locale: string;
  containerSelector?: string;
}

const DEFAULT_CONFIG: EmbedConfig = {
  brokerId: 'elibri-default',
  theme: 'dark',
  allowedPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'XAUUSD', 'USDCHF'],
  defaultPair: 'EURUSD',
  defaultSegment: 'pro',
  enableMT5: false,
  locale: 'en',
};

export function initElibriWidget(config: Partial<EmbedConfig> = {}): EmbedConfig {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Store config for global access
  (window as any).__ELIBRI_CONFIG__ = mergedConfig;

  console.log('[Elibri] Widget initialized with config:', mergedConfig);
  return mergedConfig;
}

export function getEmbedConfig(): EmbedConfig {
  return (window as any).__ELIBRI_CONFIG__ ?? DEFAULT_CONFIG;
}

// Expose init function globally for iframe/script tag integration
(window as any).__ELIBRI_INIT__ = initElibriWidget;
