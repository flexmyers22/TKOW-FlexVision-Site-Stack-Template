export const BINARY_SIGNALS = [
  { bit: 7, code: 'RUN' },
  { bit: 6, code: 'ALM' },
  { bit: 5, code: 'MAINT' },
  { bit: 4, code: 'AUTO' },
  { bit: 3, code: 'HEAT' },
  { bit: 2, code: 'FLOW' },
  { bit: 1, code: 'PRES' },
  { bit: 0, code: 'LEVEL' },
] as const;

export type BinarySignalCode = (typeof BINARY_SIGNALS)[number]['code'];

export function decodeBinaryStatus(status: string): Record<BinarySignalCode, boolean> {
  const padded = status.padStart(8, '0').slice(-8);
  const decoded = {} as Record<BinarySignalCode, boolean>;
  for (const signal of BINARY_SIGNALS) {
    decoded[signal.code] = padded[7 - signal.bit] === '1';
  }
  return decoded;
}

export function encodeBinaryStatus(flags: Partial<Record<BinarySignalCode, boolean>>): string {
  const bits = Array(8).fill('0');
  for (const signal of BINARY_SIGNALS) {
    if (flags[signal.code]) bits[7 - signal.bit] = '1';
  }
  return bits.join('');
}
