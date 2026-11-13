/**
 * generate-sample.ts
 *
 * Writes the bundled sample dataset: a cart released from rest on an incline that
 * rolls onto a level track, so position against time is a parabola followed by a
 * straight line. The data is synthetic — seeded noise on an exact model — so the
 * expected fit results are known:
 *
 *   0 ≤ t ≤ 1.5 s   x = 0.30·t²                  (a = 0.60 m/s²)
 *   t > 1.5 s       x = 0.675 + 0.90·(t − 1.5)   (v = 0.90 m/s)
 *
 * Run: node scripts/generate-sample.ts
 */

import { writeFileSync } from "node:fs";

const SAMPLE_RATE_HZ = 20;
const DURATION_S = 3;
const RAMP_END_S = 1.5;
const ACCELERATION_MPS2 = 0.6;
const NOISE_SD_M = 0.002;
const SEED = 20261112;
const OUTPUT = "src/data-lab/model/samples/cart-ramp-then-level.csv";

/** mulberry32: a small seeded generator, so the file is reproducible. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(SEED);
const gaussian = (): number => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

const rampEndPosition = 0.5 * ACCELERATION_MPS2 * RAMP_END_S ** 2;
const levelSpeed = ACCELERATION_MPS2 * RAMP_END_S;

const lines = ["Time (s),Position (m)"];
for (let i = 0; i <= SAMPLE_RATE_HZ * DURATION_S; i++) {
  const t = i / SAMPLE_RATE_HZ;
  const exact = t <= RAMP_END_S ? 0.5 * ACCELERATION_MPS2 * t * t : rampEndPosition + levelSpeed * (t - RAMP_END_S);
  lines.push(`${t.toFixed(2)},${(exact + NOISE_SD_M * gaussian()).toFixed(4)}`);
}
writeFileSync(OUTPUT, `${lines.join("\n")}\n`);
console.log(`wrote ${lines.length - 1} rows to ${OUTPUT}`);
