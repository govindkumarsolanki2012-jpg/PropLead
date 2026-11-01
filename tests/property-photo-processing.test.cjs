const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/propertyPhotoProcessing.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText;

function harness(options = {}) {
  const original = new Blob([new Uint8Array(options.size || 300000)], { type: options.type || 'image/jpeg' });
  const encoded = new Blob([new Uint8Array(7508)], { type: 'image/jpeg' });
  const urls = new Map(), revoked = [], images = [], canvases = [];
  let timer, serial = 0, draws = 0, exported;
  class Image {
    constructor() { images.push(this); }
    removeAttribute() { this.srcValue = ''; }
    set src(url) {
      this.srcValue = url;
      this.output = urls.get(url) === encoded;
      this.naturalWidth = this.output ? 1600 : (options.width || 720);
      this.naturalHeight = this.output ? 1200 : (options.height || 1600);
      if (this.output && options.outputDimensionsWrong) this.naturalWidth = 10;
      if (!this.output && options.slowSource) return;
      queueMicrotask(() => {
        if (!this.srcValue) return;
        if ((!this.output && options.invalidSource) || (this.output && options.invalidOutput)) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  class Canvas {
    constructor() { canvases.push(this); }
    getContext() {
      if (options.noContext) return null;
      return {
        drawImage: image => { draws++; this.sampled = image; },
        getImageData: () => {
          if (options.pixelReadFailure) throw new Error('Readback failed');
          const black = this.sampled instanceof Canvas ? options.canvasBlack : options.outputBlack;
          const data = new Uint8ClampedArray(16 * 16 * 4);
          for (let i = 0; i < data.length; i += 4) { data[i] = black ? 0 : 180; data[i + 3] = 255; }
          return { data };
        },
      };
    }
    toBlob(callback) {
      exported = () => callback(options.nullOutput ? null : encoded);
      if (!options.slowExport) queueMicrotask(exported);
    }
  }
  const exports = {};
  vm.runInNewContext(code, {
    exports, Blob, Image, document: { createElement: () => new Canvas() },
    URL: {
      createObjectURL: blob => { const url = `blob:${++serial}`; urls.set(url, blob); return url; },
      revokeObjectURL: url => revoked.push(url),
    },
    setTimeout: callback => { timer = callback; return 1; }, clearTimeout: () => {},
  });
  return {
    original, encoded, images, canvases, urls, revoked,
    run: () => exports.preparePropertyPhoto(original), timeout: () => timer(),
    exportLate: () => exported(), draws: () => draws,
  };
}

test('affected-size JPEG keeps exactly the original Blob without any canvas conversion', async () => {
  const h = harness();
  assert.equal(await h.run(), h.original);
  assert.equal(h.canvases.length, 0);
  assert.equal(h.revoked.length, 1);
  assert.equal(h.images[0].srcValue, '');
});
test('large photo is resized and only a decoded, nonblack result is accepted', async () => {
  const h = harness({ width: 4000, height: 3000, size: 2000000 });
  assert.equal(await h.run(), h.encoded);
  assert.equal(h.images.length, 2);
  assert.equal(h.revoked.length, 2);
  assert.ok(h.canvases.every(c => c.width === 0 && c.height === 0));
});
for (const [label, options] of Object.entries({
  'black canvas pixels': { canvasBlack: true },
  'black encoded JPEG despite good canvas': { outputBlack: true },
  'undecodable encoded JPEG': { invalidOutput: true },
  'incorrect output dimensions': { outputDimensionsWrong: true },
  'pixel readback failure': { pixelReadFailure: true },
  'missing canvas context': { noContext: true },
  'empty canvas export': { nullOutput: true },
})) {
  test(`${label}: original bytes survive`, async () => {
    const h = harness({ width: 4000, height: 3000, size: 2000000, ...options });
    assert.equal(await h.run(), h.original);
    assert.equal(h.revoked.length, h.urls.size);
  });
}
test('invalid selected file fails before upload can continue', async () => {
  const h = harness({ invalidSource: true });
  await assert.rejects(h.run(), /could not be read/);
  assert.equal(h.revoked.length, 1);
});
test('source decode timeout rejects and detached callbacks cannot allocate canvases later', async () => {
  const h = harness({ slowSource: true });
  const pending = h.run();
  const late = h.images[0].onload;
  h.timeout();
  await assert.rejects(pending, /timed out/);
  late();
  assert.equal(h.canvases.length, 0);
  assert.equal(h.images[0].onload, null);
  assert.equal(h.revoked.length, 1);
});
test('export timeout preserves original and ignores a late encoder result', async () => {
  const h = harness({ width: 4000, height: 3000, size: 2000000, slowExport: true });
  const pending = h.run();
  await Promise.resolve(); await Promise.resolve();
  h.timeout();
  assert.equal(await pending, h.original);
  h.exportLate();
  assert.equal(h.images.length, 1);
  assert.equal(h.revoked.length, 1);
});
test('property pipeline uses safe preparation while attachment compression remains unchanged', () => {
  const storage = fs.readFileSync(path.join(__dirname, '../src/utils/attachmentStorage.ts'), 'utf8');
  assert.ok(storage.includes('const compressedBlob = await preparePropertyPhoto(resolved.blob)'));
  assert.ok(storage.includes('? await compressImage(resolved.blob, resolved.fileName, 1600, 0.80)'));
});
