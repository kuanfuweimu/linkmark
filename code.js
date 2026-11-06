// Linkcard 0.3.0: canvas-only, one image node per card.
let channel = '';
let watchedPage;
let timer;
const candidates = new Map();
const sources = new Map();
const cards = new Map();
const consumed = new Set();
let readyNotified = false;
function urlFrom(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  const url = /^www\./i.test(value) ? 'https://' + value : value;
  return url.length <= 4096 && /^https?:\/\/[^\s/@?#:]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(url) && !/[\x00-\x20\x7f\\]/.test(url) ? url : '';
}
function eligible(node) {
  return node && !node.removed && node.type === 'TEXT' && node.visible && !node.locked &&
    node.parent === figma.currentPage && !node.getPluginData('linkmark');
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { flush().catch(e => console.warn(e)); }, 80);
}
async function flush() {
  if (!channel) return;
  for (const [id, createdAt] of candidates) {
    if (Date.now() - createdAt > 5000) { candidates.delete(id); continue; }
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.type !== 'TEXT' || !eligible(node) || !figma.currentPage.selection.some(n => n.id === id)) continue;
    const url = urlFrom(node.characters);
    if (!url || sources.has(id)) continue;
    candidates.delete(id);
    sources.set(id, { node, text: node.characters, url, page: figma.currentPage });
    figma.ui.postMessage({ type: 'render', channel, sourceId: id, url });
  }
}
function observe(event) {
  for (const change of event.nodeChanges) {
    if (change.origin !== 'LOCAL') continue;
    if (change.type === 'CREATE' && !consumed.has(change.id) && eligible(change.node) && candidates.size < 20) {
      candidates.set(change.id, Date.now());
    }
  }
  if (candidates.size) schedule();
}
function watchPage() {
  if (watchedPage) watchedPage.off('nodechange', observe);
  candidates.clear(); sources.clear();
  watchedPage = figma.currentPage;
  watchedPage.on('nodechange', observe);
}
function unchanged(source) {
  return source && source.page === figma.currentPage && eligible(source.node) && source.node.characters === source.text;
}
function validBytes(bytes) {
  return (Array.isArray(bytes) || bytes instanceof Uint8Array) && bytes.length > 8 && bytes.length <= 6 * 1024 * 1024;
}
function applyCard(message) {
  if (!validBytes(message.bytes)) throw new Error('Card image could not be created. The original URL is preserved.');
  const existing = cards.get(message.sourceId);
  if (existing) {
    // Never recreate deleted cards or overwrite a fill the user has replaced.
    const node = existing.node;
    if (node.removed || node.parent !== existing.page || figma.currentPage !== existing.page) return;
    const fills = node.fills;
    if (!Array.isArray(fills) || fills.length !== 1 || fills[0].type !== 'IMAGE' || fills[0].imageHash !== existing.hash) return;
    if (existing.final) return;
    const hash = figma.createImage(new Uint8Array(message.bytes)).hash;
    node.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }];
    node.name = 'Card / ' + String(message.title || existing.url).slice(0, 100);
    node.setPluginData('linkmark', JSON.stringify({ version: 3, url: existing.url, title: message.title || '', flattened: true }));
    existing.hash = hash;
    existing.final = message.final === true;
    // Preserve position, selection, scale and rotation while the preview arrives.
    return;
  }
  const source = sources.get(message.sourceId);
  if (!unchanged(source)) { sources.delete(message.sourceId); return; }
  const hash = figma.createImage(new Uint8Array(message.bytes)).hash;
  let node;
  try {
    node = figma.createRectangle();
    node.resize(360, 320);
    node.x = source.node.x; node.y = source.node.y;
    node.name = 'Card / ' + String(message.title || source.url).slice(0, 100);
    node.cornerRadius = 10;
    node.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }];
    node.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    node.strokeWeight = 1;
    node.strokeAlign = 'INSIDE';
    node.setPluginData('linkmark', JSON.stringify({ version: 3, url: source.url, title: message.title || '', flattened: true }));
    node.setPluginData('linkmarkOriginalText', source.text);
    const selected = figma.currentPage.selection;
    if (selected.some(n => n.id === source.node.id)) figma.currentPage.selection = selected.map(n => n.id === source.node.id ? node : n);
    cards.set(message.sourceId, { node, page: source.page, url: source.url, hash, final: message.final === true });
    consumed.add(message.sourceId);
    source.node.remove();
    sources.delete(message.sourceId);
    figma.commitUndo();
    if (cards.size > 100) cards.delete(cards.keys().next().value);
  } catch (error) {
    if (node && !node.removed) node.remove();
    throw error;
  }
}
figma.ui.onmessage = async message => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'ready') {
    channel = message.channel;
    figma.ui.postMessage({ type: 'init', channel });
    if (!readyNotified) {
      readyNotified = true;
      figma.notify('Linkcard 0.3.0 is running. Paste a URL onto the canvas.', { timeout: 4000 });
    }
    await flush();
    return;
  }
  if (message.channel !== channel) return;
  if (message.type === 'card') {
    try { applyCard(message); }
    catch (error) { figma.notify(error.message || 'Could not create card.', { error: true }); }
  }
  if (message.type === 'notice') figma.notify(String(message.text || '').slice(0, 220), { timeout: 4000, error: message.error === true });
};
// Hidden iframe performs metadata, image decoding and rasterization. No editor UI.
figma.showUI(__html__, { visible: false, width: 1, height: 1 });
watchPage();
figma.on('currentpagechange', watchPage);
figma.on('selectionchange', () => { if (candidates.size) schedule(); });
