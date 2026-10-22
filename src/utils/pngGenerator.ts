import zlib from 'node:zlib';

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const view = new DataView(out.buffer);
  view.setUint32(0, len, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  const crcBuf = out.subarray(4, 8 + len);
  view.setUint32(8 + len, crc32(crcBuf), false);
  return out;
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/**
 * Generates a genuine, spec-compliant binary PNG image buffer with multi-layered scenic rendering
 * (clouds, sun rays, architectural structures, water reflections, and foliage) for newspaper photojournalism.
 */
export function createEditorialPngBuffer(
  width = 640,
  height = 400,
  theme: 'dam_water' | 'paddy_harvest' | 'smart_school' | 'metro_infra' = 'dam_water'
): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 2; // color type 2 (Truecolor RGB)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = new Uint8Array(height * (1 + width * 3));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0;
    const ny = y / height;

    for (let x = 0; x < width; x++) {
      const nx = x / width;
      let r = 200;
      let g = 205;
      let b = 210;

      if (theme === 'dam_water') {
        // Golden morning sky over Kanaka Durga hill -> Prakasam Barrage red/ochre arches -> turbulent foaming water
        const sunDist = Math.hypot(nx - 0.78, ny - 0.18);
        const hillsHeight = 0.34 - 0.08 * Math.exp(-Math.pow((nx - 0.22) * 4.5, 2)) - 0.04 * Math.sin(nx * 12);

        if (ny < hillsHeight) {
          // Warm golden-blue sky with soft cloud bands
          const cloud = Math.max(0, Math.sin(nx * 18 + ny * 22) * Math.cos(nx * 9 - ny * 14)) * 22;
          const sunGlow = Math.max(0, 1 - sunDist * 2.8) * 65;
          r = clampByte(135 + ny * 160 + sunGlow + cloud);
          g = clampByte(178 + ny * 95 + sunGlow * 0.7 + cloud);
          b = clampByte(225 - ny * 40 + cloud);
        } else if (ny < 0.37) {
          // Distant Indrakeeladri green hills
          r = clampByte(58 + (ny - hillsHeight) * 180);
          g = clampByte(88 + (ny - hillsHeight) * 160);
          b = clampByte(66 + (ny - hillsHeight) * 110);
        } else if (ny < 0.56) {
          // Prakasam barrage iconic road deck, concrete piers, and radial sluice gates
          const gateIndex = nx * 16;
          const gateFrac = gateIndex - Math.floor(gateIndex);
          const isPier = gateFrac < 0.22 || gateFrac > 0.88;
          const isTopBridge = ny < 0.42;
          if (isTopBridge) {
            r = ny < 0.39 ? 168 : 132;
            g = ny < 0.39 ? 62 : 124;
            b = ny < 0.39 ? 48 : 114;
          } else if (isPier) {
            const shade = gateFrac < 0.12 ? -18 : 12;
            r = clampByte(158 + shade);
            g = clampByte(148 + shade);
            b = clampByte(134 + shade);
          } else {
            // Open steel radial gate with water pouring underneath
            if (ny < 0.49) {
              r = 52;
              g = 72;
              b = 92;
            } else {
              // White water jetting from gate opening
              const jet = Math.sin(nx * 95 + ny * 60) * 16;
              r = clampByte(218 + jet);
              g = clampByte(234 + jet);
              b = clampByte(245 + jet);
            }
          }
        } else {
          // Roaring foaming Krishna river water with whitewater spray & deep teal currents
          const distFromGate = ny - 0.56;
          const plume = Math.abs(Math.sin(nx * 16 * Math.PI));
          const turbulence =
            Math.sin(nx * 80 + ny * 55) * 18 + Math.cos(nx * 130 - ny * 90) * 12;
          const foamFactor = Math.max(0, (1 - distFromGate * 2.1) * (0.55 + 0.45 * plume));
          r = clampByte(34 + foamFactor * 205 + turbulence);
          g = clampByte(106 + foamFactor * 135 + turbulence);
          b = clampByte(148 + foamFactor * 98 + turbulence);
        }
      } else if (theme === 'paddy_harvest') {
        // Warm sunrise sky -> palm tree silhouettes -> golden paddy heaps & red/blue tarpaulins
        const horizon = 0.36 + 0.02 * Math.sin(nx * 10);
        if (ny < horizon) {
          const sun = Math.max(0, 1 - Math.hypot(nx - 0.25, ny - 0.18) * 2.5);
          r = clampByte(242 - ny * 35 + sun * 18);
          g = clampByte(208 - ny * 45 + sun * 12);
          b = clampByte(152 + ny * 55);
        } else if (ny < 0.46) {
          // Green agricultural belt & trees
          const tree = Math.sin(nx * 55) * Math.cos(nx * 23) * 18;
          r = clampByte(54 + tree);
          g = clampByte(96 + tree);
          b = clampByte(48 + tree * 0.5);
        } else {
          // Golden mounds of harvested paddy grain in market yard
          const mound1 = 0.62 - 0.14 * Math.exp(-Math.pow((nx - 0.35) * 3.8, 2));
          const mound2 = 0.65 - 0.16 * Math.exp(-Math.pow((nx - 0.72) * 3.4, 2));
          const grainTex =
            Math.sin(nx * 140 + ny * 110) * 14 + Math.cos(nx * 90 - ny * 85) * 10;
          if (ny > mound1 || ny > mound2) {
            r = clampByte(218 + grainTex - (ny - 0.5) * 45);
            g = clampByte(168 + grainTex * 0.85 - (ny - 0.5) * 40);
            b = clampByte(42 + grainTex * 0.4);
          } else {
            // Market yard concrete floor & gunny bags
            r = clampByte(164 + grainTex * 0.5);
            g = clampByte(146 + grainTex * 0.5);
            b = clampByte(118 + grainTex * 0.4);
          }
        }
      } else if (theme === 'smart_school') {
        // Bright modern classroom with glowing digital 3D science display and student silhouettes
        if (ny > 0.12 && ny < 0.66 && nx > 0.14 && nx < 0.86) {
          // Interactive flat panel bezel + glowing screen
          const inScreen = ny > 0.15 && ny < 0.63 && nx > 0.16 && nx < 0.84;
          if (!inScreen) {
            r = 28;
            g = 32;
            b = 38;
          } else {
            const cx = (nx - 0.5) * 2.2;
            const cy = (ny - 0.39) * 2.8;
            const orb = Math.hypot(cx, cy);
            const grid =
              Math.abs(Math.sin(nx * 60)) < 0.08 || Math.abs(Math.sin(ny * 45)) < 0.08 ? 28 : 0;
            if (orb < 0.55) {
              r = clampByte(35 + (0.55 - orb) * 180);
              g = clampByte(165 + (0.55 - orb) * 140);
              b = clampByte(225 + (0.55 - orb) * 50);
            } else {
              r = clampByte(16 + grid);
              g = clampByte(52 + grid + (1 - ny) * 35);
              b = clampByte(88 + grid + (1 - ny) * 45);
            }
          }
        } else if (ny >= 0.68) {
          // Classroom desks & students in uniform
          const studentHead =
            Math.exp(-Math.pow((nx - 0.25) * 9, 2) - Math.pow((ny - 0.76) * 10, 2)) +
            Math.exp(-Math.pow((nx - 0.52) * 9, 2) - Math.pow((ny - 0.75) * 10, 2)) +
            Math.exp(-Math.pow((nx - 0.76) * 9, 2) - Math.pow((ny - 0.77) * 10, 2));
          if (studentHead > 0.35) {
            r = 42;
            g = 58;
            b = 86;
          } else {
            r = clampByte(156 - (ny - 0.68) * 90);
            g = clampByte(114 - (ny - 0.68) * 70);
            b = clampByte(76 - (ny - 0.68) * 50);
          }
        } else {
          // Classroom warm cream wall
          r = 236;
          g = 231;
          b = 219;
        }
      } else {
        // Warangal Outer Ring Road Flyover & Cable-Stayed Bridge Infrastructure
        const deckY = 0.52 - 0.08 * Math.sin(nx * Math.PI);
        if (ny < deckY - 0.03) {
          // Sky with cable stays radiating from two pylons at nx=0.32 and nx=0.68
          const pylon1 = Math.abs(nx - 0.32) < 0.018 && ny > 0.16;
          const pylon2 = Math.abs(nx - 0.68) < 0.018 && ny > 0.16;
          const cable1 =
            ny > 0.18 &&
            Math.abs(
              (ny - 0.18) / (deckY - 0.18) - Math.abs(nx - 0.32) / 0.26
            ) < 0.035;
          const cable2 =
            ny > 0.18 &&
            Math.abs(
              (ny - 0.18) / (deckY - 0.18) - Math.abs(nx - 0.68) / 0.26
            ) < 0.035;
          if (pylon1 || pylon2) {
            r = 195;
            g = 82;
            b = 44;
          } else if (cable1 || cable2) {
            r = 95;
            g = 105;
            b = 118;
          } else {
            r = clampByte(164 + ny * 110);
            g = clampByte(202 + ny * 70);
            b = clampByte(238 - ny * 15);
          }
        } else if (ny < deckY + 0.05) {
          // Concrete flyover box-girder deck with saffron crash barrier
          if (ny < deckY - 0.01) {
            r = 204;
            g = 88;
            b = 38;
          } else {
            r = 148;
            g = 152;
            b = 158;
          }
        } else {
          // Piers and multi-lane blacktop highway below
          const isPier =
            (Math.abs(nx - 0.32) < 0.035 || Math.abs(nx - 0.68) < 0.035) && ny < 0.84;
          if (isPier) {
            r = 132;
            g = 136;
            b = 142;
          } else if (ny > 0.76) {
            // Highway asphalt with white lane markings
            const isLane = Math.abs(ny - 0.88) < 0.012 && Math.floor(nx * 18) % 2 === 0;
            r = isLane ? 235 : 54;
            g = isLane ? 235 : 58;
            b = isLane ? 230 : 64;
          } else {
            r = 92;
            g = 118;
            b = 84;
          }
        }
      }

      const pxOffset = rowOffset + 1 + x * 3;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', new Uint8Array(compressed));
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let pos = 0;
  png.set(signature, pos);
  pos += signature.length;
  png.set(ihdrChunk, pos);
  pos += ihdrChunk.length;
  png.set(idatChunk, pos);
  pos += idatChunk.length;
  png.set(iendChunk, pos);

  return png;
}
