import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, rBg, gBg, bBg) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: height rows, each row begins with filter byte (0) followed by width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    const ratioY = y / height;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const ratioX = x / width;

      // Gradient background: indigo (#4f46e5) to violet (#7c3aed)
      let r = Math.round(79 + ratioY * 45 + ratioX * 20);
      let g = Math.round(70 - ratioY * 12 + ratioX * 20);
      let b = Math.round(229 + ratioY * 8);
      let a = 255;

      // Draw musical setlist symbol in center
      const cx = width / 2;
      const cy = height / 2;
      const dx = (x - cx) / (width * 0.35);
      const dy = (y - cy) / (height * 0.35);

      // 3 horizontal bars (playlist)
      const inBar1 = (Math.abs(y - height * 0.38) < height * 0.02) && (x > width * 0.28 && x < width * 0.72);
      const inBar2 = (Math.abs(y - height * 0.50) < height * 0.02) && (x > width * 0.28 && x < width * 0.65);
      const inBar3 = (Math.abs(y - height * 0.62) < height * 0.02) && (x > width * 0.28 && x < width * 0.55);

      // Note head
      const distNote1 = Math.sqrt((x - width * 0.68) ** 2 + (y - height * 0.68) ** 2);
      const inNote1 = distNote1 < width * 0.08;

      // Note stem
      const inStem = (x >= width * 0.73 && x <= width * 0.76 && y >= height * 0.35 && y <= height * 0.68);
      const inFlag = (x >= width * 0.76 && x <= width * 0.85 && y >= height * 0.35 && y <= height * 0.48);

      if (inBar1 || inBar2 || inBar3 || inNote1 || inStem || inFlag) {
        r = 255;
        g = 255;
        b = 255;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) | 0;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
  }
  crcTable[n] = c;
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

fs.writeFileSync('./public/pwa-192x192.png', createPng(192, 192, 79, 70, 229));
fs.writeFileSync('./public/pwa-512x512.png', createPng(512, 512, 79, 70, 229));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPng(512, 512, 79, 70, 229));
fs.writeFileSync('./public/apple-touch-icon.png', createPng(180, 180, 79, 70, 229));
fs.writeFileSync('./public/favicon.ico', createPng(32, 32, 79, 70, 229));

console.log('Generated PNG icons successfully.');
