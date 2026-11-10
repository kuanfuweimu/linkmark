// Linkcard 0.3.5: one movable Group with a native linked title.
let channel = '';
let watchedPage;
let timer;
const candidates = new Map();
const sources = new Map();
const cards = new Map();
const consumed = new Set();
let readyNotified = false;
let clipboardSerial = 0;
const initialReplies = new Map();
const linkedCards = new Map();
const titleFont = { family: 'Inter', style: 'Regular' };
let titleFontPromise;
function loadTitleFont() {
  if (!titleFontPromise) titleFontPromise = figma.loadFontAsync(titleFont).catch(error => {
    figma.notify('标题链接未能加载，图片卡片已保留 / Title link unavailable; image card kept.', { error: true, timeout: 6000 });
    throw error;
  });
  return titleFontPromise;
}
function currentImage(record) {
  const node = record.node;
  if (node.removed || figma.currentPage !== record.page || !canvasContainer(node.parent)) return false;
  if (record.background.removed || record.background.parent !== node) return false;
  const fills = record.background.fills;
  return Array.isArray(fills) && fills.length === 1 && fills[0].type === 'IMAGE' && fills[0].imageHash === record.hash;
}
function layoutTitle(record) {
  const { background, plate, label } = record;
  if (!plate || plate.removed || !label || label.removed) return;
  const key = [background.width, background.height, background.x, background.y].join(':');
  if (record.layoutKey === key) return;
  const sx = background.width / 360, sy = background.height / 320;
  plate.resize(332 * sx, 50 * sy); plate.x = background.x + 14 * sx; plate.y = background.y + 189 * sy;
  label.fontSize = Math.max(1, 16 * Math.min(sx, sy));
  label.lineHeight = { unit: 'PIXELS', value: Math.max(1, 22 * sy) };
  label.resize(324 * sx, 44 * sy); label.x = background.x + 18 * sx; label.y = background.y + 193 * sy;
  record.layoutKey = key;
}
async function updateTitle(record) {
  // 不阻塞首卡；字体失败时保留完整图片标题。Never block the first bitmap on fonts.
  const revision = record.revision = (record.revision || 0) + 1;
  try {
    await loadTitleFont();
    if (revision !== record.revision || !currentImage(record)) return;
    let plate = record.plate, label = record.label;
    if (plate && (plate.removed || label.removed)) return;
    if (!plate) {
      plate = figma.createRectangle();
      record.plate = plate;
      plate.visible = false;
      plate.name = '标题链接 / Title link';
      plate.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      label = figma.createText();
      record.label = label;
      label.fontName = titleFont;
      label.fills = [{ type: 'SOLID', color: { r: 0.16, g: 0.16, b: 0.16 } }];
      label.textAutoResize = 'NONE';
      label.textTruncation = 'ENDING';
      label.maxLines = 2;
      label.locked = true;
      plate.locked = true;
    }
    label.characters = String(record.title || record.url).replace(/\s+/g, ' ').trim().slice(0, 1000);
    label.hyperlink = { type: 'URL', value: record.url };
    label.textDecoration = 'UNDERLINE';
    label.name = '打开原网页 / Open source';
    layoutTitle(record);
    // 先布局再入组，避免临时子节点撑大 Group。Position before grouping to keep bounds stable.
    if (plate.parent !== record.node) record.node.appendChild(plate);
    if (label.parent !== record.node) record.node.appendChild(label);
    plate.visible = true;
  } catch (_) {
    if (record.plate && !record.plate.removed) record.plate.remove();
    if (record.label && !record.label.removed) record.label.remove();
  }
}
function rememberCard(record) {
  linkedCards.set(record.node.id, record);
  if (linkedCards.size > 200) linkedCards.delete(linkedCards.keys().next().value);
  void updateTitle(record);
}
function upgradeSelectedCards() {
  // 只升级运行时选中的旧卡，不扫描整页。Upgrade only selected legacy cards on Run.
  const replacements = new Map();
  const selected = figma.currentPage.selection;
  for (const original of selected) {
    if ((original.type !== 'RECTANGLE' && original.type !== 'FRAME') || original.locked || !original.visible || !canvasContainer(original.parent)) continue;
    let data;
    try { data = JSON.parse(original.getPluginData('linkmark')); } catch (_) { continue; }
    if (!data || !(data.version === 3 && data.flattened || data.version === 4 && data.linkedTitle) || !urlFrom(data.url)) continue;
    const fills = original.fills;
    if (!Array.isArray(fills) || fills.length !== 1 || fills[0].type !== 'IMAGE') continue;
    let node, background;
    try {
      background = figma.createRectangle();
      original.parent.appendChild(background);
      background.resize(original.width, original.height);
      background.x = 0; background.y = 0;
      background.name = '卡片底图 / Card image';
      background.fills = fills;
      background.strokes = original.strokes;
      background.strokeWeight = original.strokeWeight;
      background.strokeAlign = original.strokeAlign;
      background.cornerRadius = original.cornerRadius;
      node = figma.group([background], original.parent, original.parent.children.indexOf(original));
      node.rotation = original.rotation;
      node.x = original.x; node.y = original.y;
      node.name = original.name;
      node.effects = original.effects;
      node.opacity = original.opacity;
      node.setPluginData('linkmark', JSON.stringify({ version: 5, url: data.url, title: data.title || '', linkedTitle: true }));
      node.setPluginData('linkmarkOriginalText', original.getPluginData('linkmarkOriginalText'));
      original.remove();
      replacements.set(original.id, node);
      rememberCard({ node, background, page: figma.currentPage, url: data.url, title: data.title || data.url, hash: fills[0].imageHash, final: true });
    } catch (_) {
      if (node && !node.removed) node.remove();
      else if (background && !background.removed) background.remove();
    }
  }
  if (replacements.size) {
    figma.currentPage.selection = selected.map(node => replacements.get(node.id) || node);
    figma.commitUndo();
  }
}
function requestCard(sourceId, url) {
  initialReplies.set(sourceId, setTimeout(() => {
    initialReplies.delete(sourceId);
    if (sources.has(sourceId)) figma.notify('Linkcard detected the link, but the image worker did not respond. Stop and run Linkcard again.', { error: true, timeout: 8000 });
  }, 5000));
  figma.ui.postMessage({ type: 'render', channel, sourceId, url });
}
function urlFrom(text) {
  const value = typeof text === 'string' ? text.trim() : '';
  const url = /^www\./i.test(value) ? 'https://' + value : value;
  return url.length <= 4096 && /^https?:\/\/[^\s/@?#:]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(url) && !/[\x00-\x20\x7f\\]/.test(url) ? url : '';
}
function canvasContainer(parent) {
  // 分区内的粘贴仍是画布粘贴。Section children are canvas content too.
  while (parent && !parent.removed && parent.type === 'SECTION') {
    if (!parent.visible || parent.locked) return false;
    parent = parent.parent;
  }
  return parent === figma.currentPage;
}
function eligible(node) {
  return node && !node.removed && node.type === 'TEXT' && node.visible && !node.locked &&
    canvasContainer(node.parent) && !node.getPluginData('linkmark');
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
    sources.set(id, { node, text: node.characters, url, page: figma.currentPage, parent: node.parent });
    requestCard(id, url);
  }
}
function observe(event) {
  for (const change of event.nodeChanges) {
    // Page nodechange guarantees type + node. Unlike documentchange, origin/id
    // may not exist. Keep explicit REMOTE filtering when a client supplies it.
    if (change.origin === 'REMOTE') continue;
    const linked = change.node && linkedCards.get(change.node.id);
    if (linked && change.type === 'PROPERTY_CHANGE' && currentImage(linked)) layoutTitle(linked);
    const id = change.node && change.node.id;
    if (change.type === 'CREATE' && id && !consumed.has(id) && eligible(change.node) && candidates.size < 20) {
      candidates.set(id, Date.now());
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
  return source && source.page === figma.currentPage && (source.direct || eligible(source.node) && source.node.parent === source.parent && source.node.characters === source.text);
}
function receivePaste(urls) {
  if (!Array.isArray(urls) || !urls.length || urls.length > 20) return;
  const normalized = urls.map(urlFrom);
  if (normalized.some(url => !url)) return;
  const page = figma.currentPage, center = figma.viewport.center;
  normalized.forEach((url, index) => {
    const id = 'clipboard-' + (++clipboardSerial);
    sources.set(id, { direct: true, page, text: url, url, x: center.x - 180 + (index % 4) * 384, y: center.y - 160 + Math.floor(index / 4) * 344 });
    requestCard(id, url);
  });
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
    if (node.removed || figma.currentPage !== existing.page || !canvasContainer(node.parent)) return;
    if (!currentImage(existing)) return;
    if (existing.final) return;
    const hash = figma.createImage(new Uint8Array(message.bytes)).hash;
    existing.background.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }];
    node.name = 'Card / ' + String(message.title || existing.url).slice(0, 100);
    node.setPluginData('linkmark', JSON.stringify({ version: 5, url: existing.url, title: message.title || '', linkedTitle: true }));
    existing.hash = hash;
    existing.title = message.title || existing.url;
    existing.final = message.final === true;
    void updateTitle(existing);
    // Preserve position, selection, scale and rotation while the preview arrives.
    return;
  }
  const source = sources.get(message.sourceId);
  if (!unchanged(source)) { sources.delete(message.sourceId); return; }
  const hash = figma.createImage(new Uint8Array(message.bytes)).hash;
  let node, background;
  try {
    background = figma.createRectangle();
    // 保留原分区及层级顺序，再设置局部坐标。Preserve parent/order before local coordinates.
    const parent = source.direct ? source.page : source.parent;
    parent.appendChild(background);
    background.resize(360, 320);
    background.x = source.direct ? source.x : source.node.x;
    background.y = source.direct ? source.y : source.node.y;
    background.name = '卡片底图 / Card image';
    background.cornerRadius = 10;
    background.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }];
    background.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    background.strokeWeight = 1;
    background.strokeAlign = 'INSIDE';
    node = figma.group([background], parent, source.direct ? undefined : parent.children.indexOf(source.node));
    node.name = 'Card / ' + String(message.title || source.url).slice(0, 100);
    node.setPluginData('linkmark', JSON.stringify({ version: 5, url: source.url, title: message.title || '', linkedTitle: true }));
    node.setPluginData('linkmarkOriginalText', source.text);
    const selected = figma.currentPage.selection;
    if (source.direct) figma.currentPage.selection = [node];
    else if (selected.some(n => n.id === source.node.id)) figma.currentPage.selection = selected.map(n => n.id === source.node.id ? node : n);
    const record = { node, background, page: source.page, url: source.url, title: message.title || source.url, hash, final: message.final === true };
    cards.set(message.sourceId, record);
    if (!source.direct) { consumed.add(message.sourceId); source.node.remove(); }
    sources.delete(message.sourceId);
    figma.commitUndo();
    rememberCard(record);
    if (cards.size > 100) cards.delete(cards.keys().next().value);
  } catch (error) {
    if (node && !node.removed) node.remove();
    else if (background && !background.removed) background.remove();
    throw error;
  }
}
figma.ui.onmessage = async message => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'ready') {
    channel = message.channel;
    clearTimeout(startupTimer);
    figma.ui.postMessage({ type: 'init', channel });
    if (!readyNotified) {
      readyNotified = true;
      figma.notify('Linkcard 0.3.5 ready / 已就绪，可在画布或分区内粘贴链接。', { timeout: 6000 });
      upgradeSelectedCards();
    }
    await flush();
    return;
  }
  if (message.channel !== channel) return;
  if (message.type === 'direct-paste') receivePaste(message.urls);
  if (message.type === 'worker-error') figma.notify('Linkcard worker error: ' + String(message.message || 'Unknown error').slice(0, 160), { error: true, timeout: 8000 });
  if (message.type === 'card') {
    clearTimeout(initialReplies.get(message.sourceId));
    initialReplies.delete(message.sourceId);
    try { applyCard(message); }
    catch (error) { figma.notify(error.message || 'Could not create card.', { error: true }); }
  }
  if (message.type === 'rejected') {
    // 原文本保留，不再误报 worker 无响应。Keep the source text; no false timeout.
    clearTimeout(initialReplies.get(message.sourceId));
    initialReplies.delete(message.sourceId);
    sources.delete(message.sourceId);
    figma.notify(String(message.text || 'Link was not accepted.').slice(0, 220), { error: true, timeout: 5000 });
  }
  if (message.type === 'notice')figma.notify(String(message.text || '').slice(0, 220), { timeout: 4000, error: message.error === true });
};
// Hidden iframe performs metadata, image decoding and rasterization. No editor UI.
function checkStartup() {
  if (!readyNotified) figma.notify('Linkcard could not start its image worker. Stop and run Linkcard again.', { error: true, timeout: 10000 });
}
const startupTimer = setTimeout(checkStartup, 6000);
figma.notify('Linkcard 0.3.5 starting...', { timeout: 4000 });
try {
  // Keep Figma's valid default dimensions. Hidden does not waive size limits.
  figma.showUI(__html__, { visible: false });
  watchPage();
  figma.on('currentpagechange', watchPage);
  figma.on('selectionchange', () => { if (candidates.size) schedule(); });
} catch (error) {
  clearTimeout(startupTimer);
  figma.closePlugin('Linkcard 0.3.5 startup failed: ' + String(error.message || error).slice(0, 160));
}
