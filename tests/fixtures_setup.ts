import { buildFixtures } from '../fixtures/buildBinaryFixtures';

if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this as unknown as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

if (typeof (Math as any).sumPrecise !== 'function') {
  (Math as any).sumPrecise = function (items: Iterable<number>) {
    let sum = 0;
    for (const item of items) {
      sum += Number(item);
    }
    return sum;
  };
}

await buildFixtures();
