import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = process.env.ILLUSTRATION_ORIGIN || 'http://localhost:3003';
const target = await fetch('http://localhost:9231/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (!msg.id) return;
  const entry = pending.get(msg.id);
  if (!entry) return;
  pending.delete(msg.id); clearTimeout(entry.timer);
  msg.error ? entry.reject(Error(msg.error.message)) : entry.resolve(msg.result);
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`${method} timed out`)); }, 60000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error(`Timed out: ${expression}`);
}
await call('Page.enable'); await call('Runtime.enable');
mkdirSync('artifacts/cocktail-illustrations', { recursive: true });
const checks = [];
try {
  if (process.argv.includes('--diagnose')) {
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call('Page.navigate', { url: origin + '/inspiration' });
    await until('document.readyState === "complete"');
    console.log(await evaluate('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,2500),images:[...document.images].slice(0,6).map(i=>({src:i.currentSrc,loaded:i.complete,width:i.naturalWidth,rect:i.getBoundingClientRect().toJSON()}))})'));
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync('artifacts/cocktail-illustrations/diagnostic.png', Buffer.from(screenshot.data, 'base64'));
  } else if (process.argv.includes('--gallery')) {
    await call('Emulation.setDeviceMetricsOverride', { width: 1250, height: 1550, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: `file://${process.cwd()}/artifacts/cocktail-illustrations/review.html` });
    await until('document.querySelectorAll("figure").length > 0');
    const count = await evaluate('document.querySelectorAll("figure").length');
    await evaluate('document.querySelector("main").style.gridTemplateColumns="repeat(5,1fr)"; document.querySelectorAll("img").forEach(img=>img.loading="eager")');
    for (let page = 0; page < Math.ceil(count / 25); page++) {
      await evaluate(`document.querySelectorAll("figure").forEach((figure,i)=>figure.style.display=(i>=${page * 25}&&i<${(page + 1) * 25})?"":"none")`);
      await until('[...document.querySelectorAll("figure")].filter(f=>f.style.display!=="none").every(f=>{const img=f.querySelector("img");return img.complete && img.naturalWidth>0})');
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`artifacts/cocktail-illustrations/gallery-${page + 1}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    console.log(JSON.stringify({ galleryAssets: count }));
  } else {
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const [name, path] of [
      ['menu', '/inspiration'],
      ['margarita', '/inspiration/classic-remix?cocktail=margarita'],
      ['alexander', '/inspiration/classic-remix?cocktail=alexander'],
      ['coconut-rum', '/inspiration/convenience-mix?cocktail=coconut-rum'],
    ]) {
      await call('Page.navigate', { url: origin + path });
      await until(`location.href === ${JSON.stringify(origin + path)} && document.readyState === "complete" && document.querySelector("img.cocktail-illustration")?.naturalWidth > 0`);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const state = await evaluate(`({images:[...document.querySelectorAll('img.cocktail-illustration')].slice(0,4).map(i=>({alt:i.alt,src:i.getAttribute('src'),loaded:i.naturalWidth>0})),plateRatios:[...document.querySelectorAll('.cocktail-plate')].slice(0,4).map(p=>p.getBoundingClientRect().height/p.getBoundingClientRect().width),overflow:document.documentElement.scrollWidth>innerWidth})`);
      assert.equal(state.overflow, false, `Horizontal overflow: ${name}`);
      assert.ok(state.images.some(img => img.loaded), `No rendered illustration: ${name}`);
      assert.ok(state.plateRatios.every(ratio => Math.abs(ratio - 0.75) < 0.03), `Illustration changed the card aspect ratio: ${name} ${JSON.stringify(state.plateRatios)}`);
      checks.push({ name, ...state });
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`artifacts/cocktail-illustrations/mobile-${name}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    writeFileSync('artifacts/cocktail-illustrations/browser-check.json', JSON.stringify(checks, null, 2) + '\n');
    console.log(JSON.stringify(checks, null, 2));
  }
} finally {
  await call('Page.close').catch(() => {}); ws.close();
}
