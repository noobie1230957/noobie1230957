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
  charts: {from: 0, durationInFrames: 60},
  messy: {from: 60, durationInFrames: 60},
  indicators: {from: 120, durationInFrames: 50},
  fakeSignals: {from: 170, durationInFrames: 50},
  identify: {from: 220, durationInFrames: 50},
  easy: {from: 270, durationInFrames: 50},
  money: {from: 320, durationInFrames: 55},
  brand: {from: 375, durationInFrames: 45},
  howItWorks: {from: 420, durationInFrames: 270},
  access: {from: 690, durationInFrames: 135},
  benefits: {from: 825, durationInFrames: 150},
  testimonial: {from: 975, durationInFrames: 60},
  endCard: {from: 1035, durationInFrames: 75},
} as const;
