import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:3000';
const durationMs = Number(process.argv[3] ?? 18000);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['camera'],
});

const page = await context.newPage();
const events = [];

function push(type, text, data) {
  events.push({
    type,
    text,
    data,
    at: new Date().toISOString(),
  });
}

page.on('console', async (msg) => {
  let values = [];
  try {
    values = await Promise.all(msg.args().map((arg) => arg.jsonValue().catch(() => undefined)));
  } catch {
    values = [];
  }
  push(`console:${msg.type()}`, msg.text(), values);
});

page.on('pageerror', (err) => push('pageerror', err.message, err.stack));
page.on('requestfailed', (req) => push('requestfailed', req.url(), req.failure()));
page.on('response', (res) => {
  if (res.status() >= 400) push('http-error', `${res.status()} ${res.url()}`);
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const initialState = await page.evaluate(async () => {
  const devices = await navigator.mediaDevices.enumerateDevices().catch((err) => ({ error: String(err) }));
  return {
    href: location.href,
    isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices),
    devices,
    debugLogs: window.__GESTURE_DEBUG_LOGS ?? [],
    statusText: document.body.innerText,
  };
});

push('snapshot:initial', 'Initial browser state', initialState);

await page.waitForTimeout(durationMs);

const finalState = await page.evaluate(() => ({
  debugLogs: window.__GESTURE_DEBUG_LOGS ?? [],
  statusText: document.body.innerText,
  handStatus: document.querySelector('.hand-status')?.textContent ?? null,
  webcamStatus: document.querySelector('.webcam-status')?.textContent ?? null,
  hasDebugOverlay: Boolean(document.querySelector('.hand-debug-overlay')),
}));

push('snapshot:final', 'Final browser state', finalState);

await page.screenshot({ path: 'tmp-playwright-diagnose.png', fullPage: true });
await writeFile('tmp-playwright-diagnose.json', JSON.stringify(events, null, 2), 'utf8');

console.log(JSON.stringify({
  eventCount: events.length,
  finalHandStatus: finalState.handStatus,
  finalWebcamStatus: finalState.webcamStatus,
  screenshot: 'tmp-playwright-diagnose.png',
  logFile: 'tmp-playwright-diagnose.json',
}, null, 2));

await browser.close();
