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

// Scene boundaries in frames (from + durationInFrames), frame-exact.
export const SCENES = {
  charts: {from: 0, durationInFrames: 52},
  messy: {from: 52, durationInFrames: 52},
  indicators: {from: 104, durationInFrames: 48},
  fakeSignals: {from: 152, durationInFrames: 48},
  identify: {from: 200, durationInFrames: 48},
  easy: {from: 248, durationInFrames: 48},
  money: {from: 296, durationInFrames: 52},
  brand: {from: 348, durationInFrames: 42},
  howItWorks: {from: 390, durationInFrames: 240},
  dashboard: {from: 630, durationInFrames: 105},
  access: {from: 735, durationInFrames: 100},
  benefits: {from: 835, durationInFrames: 145},
  testimonial: {from: 980, durationInFrames: 60},
  endCard: {from: 1040, durationInFrames: 70},
} as const;
