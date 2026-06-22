/** Clamp a number into the 0..1 range. */
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
