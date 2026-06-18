// Shared design tokens for the TUX S&D Kinetic ad.
export const COLORS = {
  bg: '#F5F5F5',
  bgDark: '#0A0A0A',
  ink: '#0A0A0A',
  inkSoft: '#6B7280',
  red: '#EF4444',
  // Brand accent (TUX S&D Kinetic) - supply/demand trading green.
  brand: '#10B981',
  brandDark: '#059669',
  zoneDemand: 'rgba(16, 185, 129, 0.16)',
  zoneSupply: 'rgba(239, 68, 68, 0.16)',
};

export const FONT_FAMILY_FALLBACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// 37s @ 30fps = 1110 frames (matches the reference track length).
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 37 * FPS;

// Scene boundaries in frames (from) + durations in seconds.
export const SCENES = {
  charts: {from: 0, durationInSeconds: 2},
  messy: {from: 60, durationInSeconds: 2},
  indicators: {from: 120, durationInSeconds: 2},
  fakeSignals: {from: 180, durationInSeconds: 2},
  identify: {from: 240, durationInSeconds: 2},
  easy: {from: 300, durationInSeconds: 2},
  money: {from: 360, durationInSeconds: 2},
  brand: {from: 420, durationInSeconds: 1.5},
  howItWorks: {from: 465, durationInSeconds: 9},
  access: {from: 735, durationInSeconds: 5},
  benefits: {from: 885, durationInSeconds: 5},
  endCard: {from: 1035, durationInSeconds: 2.5},
} as const;
