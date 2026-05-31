// Chart price range: 44 - 72
// Long Power Level: 49, Short Power Level: 68
// Scene layout: bearish trend → bounce at 49 → rally → reject at 68

export const CHART = {
  priceMin: 43,
  priceMax: 73,
  longPower: 49,
  shortPower: 68,
  width: 900,
  height: 420,
  paddingLeft: 60,
  paddingRight: 80,
  paddingTop: 30,
  paddingBottom: 30,
};

export function priceToY(price) {
  const { priceMin, priceMax, height, paddingTop, paddingBottom } = CHART;
  const range = priceMax - priceMin;
  const chartH = height - paddingTop - paddingBottom;
  return paddingTop + chartH * (1 - (price - priceMin) / range);
}

export function indexToX(index, total) {
  const { width, paddingLeft, paddingRight } = CHART;
  const chartW = width - paddingLeft - paddingRight;
  return paddingLeft + (index / (total - 1)) * chartW;
}

// Full candle sequence across all 6 scenes
// Each: { open, high, low, close, scene }
export const CANDLES = [
  // Scene 1: Bearish trend down from ~65 to ~51
  { o: 65.2, h: 66.1, l: 63.8, c: 64.0, scene: 1 },
  { o: 64.0, h: 64.5, l: 62.2, c: 62.5, scene: 1 },
  { o: 62.5, h: 63.0, l: 60.5, c: 60.8, scene: 1 },
  { o: 60.8, h: 61.2, l: 58.8, c: 59.1, scene: 1 },
  { o: 59.1, h: 59.8, l: 57.2, c: 57.5, scene: 1 },
  { o: 57.5, h: 58.1, l: 55.5, c: 55.8, scene: 1 },
  { o: 55.8, h: 56.2, l: 53.5, c: 53.8, scene: 1 },
  { o: 53.8, h: 54.3, l: 51.8, c: 52.0, scene: 1 },
  // Scene 2: Price reaches Long Power Level ~49, slow grind
  { o: 52.0, h: 52.4, l: 50.1, c: 50.3, scene: 2 },
  { o: 50.3, h: 50.8, l: 48.8, c: 49.2, scene: 2 },
  { o: 49.2, h: 49.9, l: 48.5, c: 49.0, scene: 2 },
  { o: 49.0, h: 49.7, l: 48.4, c: 49.3, scene: 2 },
  // Scene 3: Bullish reversal — BUY signal
  { o: 49.3, h: 50.8, l: 49.0, c: 50.5, scene: 3 },
  { o: 50.5, h: 52.5, l: 50.3, c: 52.2, scene: 3 },
  { o: 52.2, h: 54.0, l: 52.0, c: 53.8, scene: 3 },
  { o: 53.8, h: 55.5, l: 53.5, c: 55.2, scene: 3 },
  // Scene 4: Rally projection path
  { o: 55.2, h: 57.3, l: 55.0, c: 57.0, scene: 4 },
  { o: 57.0, h: 59.5, l: 56.8, c: 59.2, scene: 4 },
  { o: 59.2, h: 61.5, l: 59.0, c: 61.3, scene: 4 },
  { o: 61.3, h: 63.5, l: 61.1, c: 63.2, scene: 4 },
  { o: 63.2, h: 65.5, l: 63.0, c: 65.3, scene: 4 },
  // Scene 5: Approaching Short Power Level
  { o: 65.3, h: 67.2, l: 65.1, c: 67.0, scene: 5 },
  { o: 67.0, h: 68.5, l: 66.8, c: 68.1, scene: 5 },
  { o: 68.1, h: 68.9, l: 67.5, c: 68.3, scene: 5 },
  // Scene 6: Rejection — SELL signal
  { o: 68.3, h: 68.8, l: 65.5, c: 65.8, scene: 6 },
  { o: 65.8, h: 66.2, l: 63.0, c: 63.3, scene: 6 },
  { o: 63.3, h: 63.8, l: 61.0, c: 61.2, scene: 6 },
];

export const TOTAL_CANDLES = CANDLES.length;

// Kinetic trailing stop values (above price in bearish, below in bullish)
export const KINETIC = [
  67.0, 66.5, 65.2, 63.8, 62.0, 60.5, 58.5, 56.5, // Scene 1 — above price
  54.8, 53.0, 51.8, 51.2,                           // Scene 2 — still above
  49.0, 49.5, 50.8, 52.5,                           // Scene 3 — flips below
  54.0, 56.2, 58.5, 60.8, 63.0,                     // Scene 4 — below price
  65.0, 66.5, 67.2,                                  // Scene 5 — below
  66.0, 64.0, 62.0,                                  // Scene 6 — flips above
];

// Scene time boundaries (in seconds, total 24s)
export const SCENE_TIMES = [0, 4, 8, 12, 16, 20, 24];
