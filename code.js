// Linkmark — standard Figma Design plugin. No build step or dependencies.
figma.showUI(__html__, { width: 400, height: 800, themeColors: true });
figma.root.setRelaunchData({ open: "Create a link card" });
let running = false;
let lastCard = null;
/** @param {string} hex @returns {SolidPaint} */
const solid = (hex) => ({ type: 'SOLID', color: {
  r: parseInt(hex.slice(0, 2), 16) / 255,
  g: parseInt(hex.slice(2, 4), 16) / 255,
  b: parseInt(hex.slice(4, 6), 16) / 255
} });
function validUrl(value) {
  return typeof value === 'string' && value.length <= 4096 &&
    /^https?:\/\/[^\s/@?#:]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value) &&
    !/[\x00-\x20\x7f\\]/.test(value);
}
function boundedText(value, max) {
  return typeof value === 'string' ? value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, max) : '';
}
async function fontsFor(content) {
  let regular = { family: 'Inter', style: 'Regular' };
  let strong = { family: 'Inter', style: 'Semi Bold' };
  if (/[\u3000-\u9fff]/.test(content)) {
    const available = await figma.listAvailableFontsAsync();
    for (const family of ['Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'Source Han Sans SC']) {
      const faces = available.map(f => f.fontName).filter(f => f.family === family);
      const normal = faces.find(f => /^(Regular|Normal)$/i.test(f.style));
      if (normal) {
        regular = normal;
        strong = faces.find(f => /^(SemiBold|Semi Bold|Bold|Medium)$/i.test(f.style)) || normal;
        break;
      }
    }
  }
  await Promise.all([figma.loadFontAsync(regular), figma.loadFontAsync(strong)]);
  return { regular, strong };
}
/**
 * @param {FrameNode} parent
 * @param {string} name
 * @param {string} content
 * @param {number} width
 * @param {number} size
 * @param {number} lineHeight
 * @param {FontName} font
 * @param {string} color
 * @param {number} lines
 */
function makeText(parent, name, content, width, size, lineHeight, font, color, lines) {
  const node = figma.createText();
  parent.appendChild(node);
  node.name = name;
  node.fontName = font;
  node.fontSize = size;
  node.lineHeight = { unit: 'PIXELS', value: lineHeight };
  node.characters = content;
  node.fills = [solid(color)];
  node.resize(width, lineHeight);
  node.textAutoResize = 'HEIGHT';
  node.textTruncation = 'ENDING';
  node.maxLines = lines;
  node.layoutSizingHorizontal = 'FILL';
  return node;
}
function timeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  })]).finally(() => clearTimeout(timer));
}
async function insertCard(message) {
  const p = message.card || {};
  if (!validUrl(p.url)) throw new Error('Enter a valid http or https URL.');
  const title = boundedText(p.title, 240);
  if (!title) throw new Error('Add a card title first.');
  const description = boundedText(p.description, 600);
  const domain = p.url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].replace(/^www\./, '');
  const horizontal = p.layout === 'horizontal';
  const width = horizontal ? 480 : 360;
  const showImage = p.showImage === true;
  let imageHash = null;
  let logoHash = null;
  // Prepare assets before touching the canvas. Failure leaves no partial card.
  if (showImage) {
    if (Array.isArray(p.imageBytes) && p.imageBytes.length > 0 && p.imageBytes.length <= 6 * 1024 * 1024 &&
        p.imageBytes.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) {
      imageHash = figma.createImage(new Uint8Array(p.imageBytes)).hash;
    } else if (validUrl(p.imageUrl)) {
      try {
        imageHash = (await timeout(figma.createImageAsync(p.imageUrl), 18000, 'Image download timed out.')).hash;
      } catch (_) {
        throw new Error('Cannot import this cover. Upload an image under Edit content, or turn off Show cover and try again.');
      }
    } else {
      throw new Error('Add a cover image or turn off Show cover.');
    }
  }
  if (validUrl(p.logoUrl)) {
    try { logoHash = (await timeout(figma.createImageAsync(p.logoUrl), 5000, 'Icon timeout')).hash; }
    catch (_) { /* A missing favicon is replaced by a local link icon. */ }
  }
  const fonts = await fontsFor(title + description);
  const center = figma.viewport.center;
  let card;
  try {
    card = figma.createFrame();
    card.name = 'Bookmark / ' + title.slice(0, 60);
    card.resize(width, horizontal ? 168 : 320);
    card.layoutMode = horizontal ? 'HORIZONTAL' : 'VERTICAL';
    card.primaryAxisSizingMode = horizontal ? 'FIXED' : 'AUTO';
    card.counterAxisSizingMode = horizontal ? 'AUTO' : 'FIXED';
    card.itemSpacing = 0;
    card.cornerRadius = 12;
    card.clipsContent = true;
    card.fills = [solid('FFFFFF')];
    card.strokes = [solid('E5E5E1')];
    card.strokeWeight = 1;
    card.strokeAlign = 'INSIDE';
    card.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL' }];
    if (showImage) {
      const cover = figma.createRectangle();
      card.appendChild(cover);
      cover.name = 'Cover';
      cover.resize(horizontal ? 160 : width, horizontal ? 168 : 202.5);
      cover.fills = [{ type: 'IMAGE', imageHash, scaleMode: 'FILL' }];
      if (horizontal) cover.layoutSizingVertical = 'FILL';
      else cover.layoutSizingHorizontal = 'FILL';
    }
    const body = figma.createFrame();
    card.appendChild(body);
    body.name = 'Content';
    const bodyWidth = horizontal && showImage ? width - 160 : width;
    body.resize(bodyWidth, 150);
    body.layoutMode = 'VERTICAL';
    body.primaryAxisSizingMode = 'AUTO';
    body.counterAxisSizingMode = 'FIXED';
    body.paddingTop = body.paddingBottom = 20;
    body.paddingLeft = body.paddingRight = 20;
    body.itemSpacing = 8;
    body.fills = [];
    body.layoutSizingHorizontal = 'FILL';
    const textWidth = bodyWidth - 40;
    const heading = makeText(body, 'Title', title, textWidth, 18, 25, fonts.regular, '292929', 2);
    heading.hyperlink = { type: 'URL', value: p.url };
    heading.textDecoration = 'NONE';
    if (description) makeText(body, 'Description', description, textWidth, 14, 21, fonts.regular, '858585', 2);
    const source = figma.createFrame();
    body.appendChild(source);
    source.name = 'Source';
    source.resize(textWidth, 25);
    source.layoutMode = 'HORIZONTAL';
    source.primaryAxisSizingMode = 'FIXED';
    source.counterAxisSizingMode = 'AUTO';
    source.counterAxisAlignItems = 'CENTER';
    source.paddingTop = 5;
    source.itemSpacing = 8;
    source.fills = [];
    source.layoutSizingHorizontal = 'FILL';
    let icon;
    if (logoHash) {
      icon = figma.createRectangle();
      icon.fills = [{ type: 'IMAGE', imageHash: logoHash, scaleMode: 'FIT' }];
    } else {
      icon = figma.createNodeFromSvg('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" stroke="#858585" stroke-width="1.8" stroke-linecap="round"/></svg>');
    }
    source.appendChild(icon);
    icon.name = 'Website icon';
    icon.resize(16, 16);
    const site = makeText(source, 'Source link', domain, textWidth - 24, 13, 20, fonts.regular, '858585', 1);
    site.hyperlink = { type: 'URL', value: p.url };
    site.textDecoration = 'UNDERLINE';
    if (horizontal && showImage) card.appendChild(card.children[0]);
    card.setPluginData('linkmark', JSON.stringify({ version: 1, url: p.url }));
    card.setRelaunchData({ open: 'Create another card from this link' });
    if (lastCard && !lastCard.removed && lastCard.parent === figma.currentPage) {
      card.x = lastCard.x + lastCard.width + 24;
      card.y = lastCard.y;
    } else {
      card.x = center.x - card.width / 2;
      card.y = center.y - card.height / 2;
    }
    lastCard = card;
    figma.currentPage.selection = [card];
    figma.viewport.scrollAndZoomIntoView([card]);
    figma.notify('Link card inserted. Text and images are editable.');
    return card.id;
  } catch (error) {
    if (card && !card.removed) card.remove();
    throw error;
  }
}
figma.ui.onmessage = async (message) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'ready') {
    let url = '';
    const selected = figma.currentPage.selection;
    if (selected.length === 1) {
      const node = selected[0];
      try { url = JSON.parse(node.getPluginData('linkmark') || '{}').url || ''; } catch (_) {}
      if (!url && node.type === 'TEXT' && validUrl(node.characters.trim())) url = node.characters.trim();
    }
    figma.ui.postMessage({ type: 'init', url });
    return;
  }
  if (message.type !== 'insert' || running) return;
  running = true;
  try {
    const id = await insertCard(message);
    figma.ui.postMessage({ type: 'inserted', id });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error.message || 'Could not create the card. Please try again.' });
  } finally {
    running = false;
  }
};
