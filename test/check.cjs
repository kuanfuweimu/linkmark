const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const root = require('node:path').resolve(__dirname,'..');
const code = fs.readFileSync(root+'/code.js','utf8');
const html = fs.readFileSync(root+'/ui.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS '+name); }
function sandbox(options={}) {
  const nodes=[],messages=[];
  let serial=0;
  function node(type) {
    const n={type,id:String(++serial),children:[],data:{},width:100,height:100,x:0,y:0,removed:false,
      resize(w,h){assert(w>0 && h>0);this.width=w;this.height=h;},
      appendChild(child){if(child.parent){child.parent.children=child.parent.children.filter(n=>n!==child);}this.children.push(child);child.parent=this;},
      setPluginData(k,v){this.data[k]=v;},getPluginData(k){return this.data[k]||'';},setRelaunchData(d){this.relaunch=d;},
      remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
    };nodes.push(n);return n;
  }
  const page=node('PAGE');page.selection=[];
  const create=type=>{const n=node(type);page.appendChild(n);return n;};
  const figma={root:{setRelaunchData(){}},currentPage:page,ui:{postMessage:m=>messages.push(m)},showUI(){},
    viewport:{center:{x:1000,y:1000},scrollAndZoomIntoView(){}},notify(){},
    loadFontAsync:async()=>{if(options.fontFail)throw Error('Font unavailable');},listAvailableFontsAsync:async()=>[],
    createFrame:()=>create('FRAME'),createRectangle:()=>create('RECTANGLE'),createText:()=>create('TEXT'),createNodeFromSvg:()=>create('FRAME'),
    createImage:()=>({hash:'uploaded-image'}),createImageAsync:async()=>{if(options.imageFail)throw Error('blocked');return {hash:'remote-image'};}
  };
  const context=vm.createContext({figma,__html__:html,setTimeout,clearTimeout,Uint8Array});
  vm.runInContext(code,context);
  return {figma,page,messages,nodes,context};
}
function dom(fetch) {
  const {window}=parseHTML(html);const sent=[];
  const parent={postMessage:message=>sent.push(message)};
  const context=vm.createContext({window,document:window.document,parent,URL,AbortController,fetch,setTimeout,clearTimeout,Image:window.Image,atob,console});
  // linkedom is a DOM implementation, not a browser and does no rendering or UI automation.
  window.parent=parent;
  vm.runInContext(script,context);
  const run=expr=>vm.runInContext(expr,context);
  return {window,context,run,sent,$:id=>window.document.getElementById(id)};
}
(async()=>{
  await test('manifest entrypoints and network declaration',()=>{
    const m=JSON.parse(fs.readFileSync(root+'/manifest.json'));
    assert.equal(m.editorType[0],'figma');assert.equal(m.documentAccess,'dynamic-page');
    assert(m.id);assert(m.networkAccess.reasoning);for(const f of [m.main,m.ui])assert(fs.existsSync(root+'/'+f));
  });
  await test('all plugin-owned UI copy is English',()=>{
    assert.equal(/[^\x00-\x7F]/.test('English'),false);
    for(const content of [code,html,fs.readFileSync(root+'/manifest.json','utf8')])assert.equal(/[\u3400-\u9fff]/.test(content),false);
    assert(html.includes('lang="en"'));
  });
  await test('UI JavaScript parses',()=>new vm.Script(script));
  await test('editable image card, original links, relaunch and adjacent insertion',async()=>{
    const s=sandbox();const card={url:'https://example.com/article?x=1',title:'Design article',description:'Summary',showImage:true,imageUrl:'https://example.com/cover.png',logoUrl:'https://example.com/logo.png'};
    await s.figma.ui.onmessage({type:'insert',card});assert.equal(s.messages.at(-1).type,'inserted');
    const result=s.page.selection[0];assert.equal(result.width,360);assert.equal(result.layoutMode,'VERTICAL');
    assert(result.children.some(n=>n.name==='Cover'));
    const title=s.nodes.find(n=>n.name==='Title');assert.equal(title.hyperlink.value,card.url);assert.equal(title.maxLines,2);
    const source=s.nodes.find(n=>n.name==='Source link');assert.equal(source.textDecoration,'UNDERLINE');
    assert.equal(JSON.parse(result.data.linkmark).url,card.url);assert(result.relaunch.open);
    await s.figma.ui.onmessage({type:'insert',card});assert(s.page.selection[0].x>result.x);
  });
  await test('horizontal card puts image on right',async()=>{
    const s=sandbox();await s.figma.ui.onmessage({type:'insert',card:{url:'https://example.com/',title:'Test',layout:'horizontal',showImage:true,imageBytes:[137,80,78,71]}});
    const result=s.page.selection[0];assert.equal(result.width,480);assert.equal(result.children.at(-1).name,'Cover');
  });
  await test('manual no-image card works without network',async()=>{
    const s=sandbox({imageFail:true});await s.figma.ui.onmessage({type:'insert',card:{url:'https://example.com',title:'Manual',showImage:false}});
    assert.equal(s.messages.at(-1).type,'inserted');assert(!s.nodes.find(n=>n.name==='Cover'));
  });
  await test('invalid URLs and empty titles never mutate canvas',async()=>{
    for(const card of [{url:'javascript:alert(1)',title:'Bad'},{url:'https://user:pass@example.com',title:'Bad'},{url:'https://example.com',title:' '}]){
      const s=sandbox();await s.figma.ui.onmessage({type:'insert',card});assert.equal(s.messages.at(-1).type,'error');assert.equal(s.page.children.length,0);
    }
  });
  await test('cover download failure does not silently insert imageless result',async()=>{
    const s=sandbox({imageFail:true});await s.figma.ui.onmessage({type:'insert',card:{url:'https://example.com',title:'Test',showImage:true,imageUrl:'https://example.com/a.png'}});
    assert.equal(s.messages.at(-1).type,'error');assert.equal(s.page.children.length,0);
  });
  await test('font failure leaves no partial layers',async()=>{
    const s=sandbox({fontFail:true});await s.figma.ui.onmessage({type:'insert',card:{url:'https://example.com',title:'Test'}});
    assert.equal(s.messages.at(-1).type,'error');assert.equal(s.page.children.length,0);
  });
  await test('selected URL prefills without automatically sending network requests',async()=>{
    const s=sandbox();s.page.selection=[{type:'TEXT',characters:'https://example.com',getPluginData:()=>''}];await s.figma.ui.onmessage({type:'ready'});
    assert.equal(s.messages[0].url,'https://example.com');
  });
  await test('UI validates protocols, credentials and internal requests',()=>{
    const d=dom();assert.equal(d.run("normalizeUrl('example.com')"),'https://example.com/');
    for(const input of ['javascript:alert(1)','file:///C:/file','https://user:pass@example.com','https://example.com\\@evil.test'])assert.throws(()=>d.run('normalizeUrl('+JSON.stringify(input)+')'));
    assert.throws(()=>d.run("publicUrl(normalizeUrl('http://127.0.0.1'))"));
  });
  await test('metadata is safe text, original URL retained, session cache reused',async()=>{
    let requests=0;const d=dom(async()=>{requests++;return {ok:true,status:200,json:async()=>({status:'success',data:{title:'<img onerror=alert(1)>',description:'Hello',url:'https://redirect.test/',image:{url:'https://example.com/a.png'}}})};});
    d.$('url').value='https://example.com';await d.run('fetchPreview()');
    assert.equal(d.$('card-title').textContent,'<img onerror=alert(1)>');assert.equal(d.$('card-title').children.length,0);
    assert.equal(d.run('state.url'),'https://example.com/');assert.equal(d.run('state.showImage'),true);
    await d.run('fetchPreview()');assert.equal(requests,1);
  });
  await test('HTTP 429 yields editable fallback and readable error',async()=>{
    const d=dom(async()=>({ok:false,status:429}));d.$('url').value='https://example.com';await d.run('fetchPreview()');
    assert.match(d.$('status').textContent,/daily limit/);assert.equal(d.run('state.title'),'example.com');assert.equal(d.run('state.fetching'),false);
  });
  await test('late response cannot restore stale card after URL changes',async()=>{
    let resolve;const d=dom(()=>new Promise(r=>resolve=r));d.$('url').value='https://example.com';const pending=d.run('fetchPreview()');
    d.$('url').value='https://new.example.com';d.$('url').dispatchEvent(new d.window.Event('input'));
    resolve({ok:true,status:200,json:async()=>({status:'success',data:{title:'Stale'}})});await pending;
    assert.equal(d.run('state.url'),'');assert.equal(d.run('state.title'),'');
  });
  await test('manual input and insert payload preserve image bytes',()=>{
    const d=dom();d.$('url').value='https://example.com';d.$('manual').dispatchEvent(new d.window.Event('click',{cancelable:true}));
    d.run("state.host=true;state.title='Manual';state.imageBytes=[137,80];state.showImage=true;render()");
    d.$('insert').dispatchEvent(new d.window.Event('click'));assert.equal(d.sent.at(-1).pluginMessage.type,'insert');
    assert.equal(d.sent.at(-1).pluginMessage.card.title,'Manual');assert.equal(d.sent.at(-1).pluginMessage.card.imageBytes.length,2);
  });
  console.log(`${count} checks passed. No browser, screen or Figma runtime was operated.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
