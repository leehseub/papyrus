// Integration checks against the built editor in an isolated Electron window.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
// Check target disambiguation independently of the UI.
const ts = require('typescript');
const vm = require('node:vm');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/wikilinks.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, context);
const helpers = context.exports;
assert.equal(helpers.nextNewNoteName('link', [{title:'LINK'},{title:'link(1)'}]), 'link(2)');
assert.equal(helpers.nextNewNoteName('link', [{title:'linked'}]), 'link');
assert.equal(helpers.nextNewNoteName('', []), null);
const backlinkContext = { exports: {}, require: () => helpers };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/backlinks.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, backlinkContext);
const backlinkFiles = ['V/one/Same.md', 'V/two/Same.md', 'V/one/Source.md'].map(p => ({name:p.split('/').pop(),path:p}));
const extract = text => backlinkContext.exports.findBacklinkExcerpts(text, backlinkFiles, 'V/one/Source.md', 'V/two/Same.md');
assert.equal(extract('[[Same]]').length, 0, 'Bare links resolve to the source folder');
const contextual = extract('Previous context\r\n\r\nLink [[two/Same]] here\r\n\r\nFollowing context')[0];
assert.equal(contextual.before, 'Previous context');
assert.equal(contextual.after, 'Following context');
assert.equal(contextual.line, 3);
assert.equal(extract('[[two/Same]]')[0].before, '');
assert.equal(extract('[[two/Same]]')[0].after, '');
assert.equal(extract('[[two/Same]] and [[two/Same]]').length, 1, 'One excerpt per matching line');
assert.equal(extract('\\[\\[two/Same\\]\\]').length, 1, 'Saved escaped links are supported');
assert.equal(extract(['~~~md','[[two/Same]]','~~~','    [[two/Same]]','`[[two/Same]]`'].join('\n')).length, 0, 'Code examples are excluded');
assert.equal(backlinkContext.exports.findBacklinkExcerpts('[[Same]]', backlinkFiles, 'V/two/Same.md', 'V/two/Same.md').length, 0, 'Self references are excluded');
const files = ['Vault/Same.md', 'Vault/one/Same.md', 'Vault/two/Same.md'].map(p => ({name:'Same.md',path:p}));
const choices = helpers.buildWikilinkOptions(files);
for (const choice of choices) assert.equal(helpers.resolveWikilink(files,choice.target,'Vault/two/Source.md').path,choice.path);
assert.equal(helpers.resolveWikilink(files,'missing/Same','Vault/two/Source.md'),undefined);
const samples=['V/A/Design/Note.md','V/B/Design/Note.md','V/Design/Note.md','V/Note.md','V/Unique.md'].map(p=>({name:p.split('/').pop(),path:p}));
const labels=helpers.buildNoteLabels(samples);
assert.equal(labels.get(samples[0].path).context,'A / Design');
assert.equal(labels.get(samples[1].path).context,'B / Design');
assert.equal(labels.get(samples[2].path).context,'/ Design');
assert.equal(labels.get(samples[3].path).context,'/');
assert.equal(labels.get(samples[4].path).context,'');

const fixture = path.join(root, 'node_modules/.tmp/wikilink-vault');
for (const name of ['one', 'two']) fs.mkdirSync(path.join(fixture, name), { recursive: true });
for (const [file, text] of Object.entries({
  'Source.md': '# Source\n\n', 'Beta.md': '# Beta', 'Better.md': '# Better',
  '한글 노트.md': '# 한글 노트', 'one/Same.md': '# Same', 'two/Same.md': '# Same',
})) fs.writeFileSync(path.join(fixture, file), text);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;
const js = code => win.webContents.executeJavaScript(code);
async function until(code) {
  for (let i = 0; i < 100; i++) { if (await js(code)) return; await pause(60); }
  throw new Error('Timed out: ' + code);
}
const press = key => js(`document.querySelector('.tiptap-editor').dispatchEvent(new KeyboardEvent('keydown', {key: ${JSON.stringify(key)}, bubbles: true, cancelable: true}))`);
async function reset(type = 'paragraph', text = '') {
  await js(`(() => {
    const editor = document.querySelector('.tiptap-editor').editor;
    editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Source'}]},{type:${JSON.stringify(type)},content:${text ? JSON.stringify([{type:'text',text}]) : '[]'}}]});
    editor.commands.focus('end');
  })()`);
  await pause(60);
}
const insert = text => js(`document.querySelector('.tiptap-editor').editor.commands.insertContent(${JSON.stringify(text)})`);
const body = () => js("document.querySelector('.tiptap-editor').editor.state.doc.lastChild.textContent");
async function trigger(query = '') { await press('['); await press('['); if (query) await insert(query); await until("!!document.querySelector('.wikilink-menu')"); }
async function checkTooltip(selector, runner = js) {
  const expected = await runner(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'})); return el.getAttribute('data-tooltip'); })()`);
  await pause(150);
  assert.ok(expected);
  assert.equal(await runner("document.querySelector('[role=tooltip]')?.textContent.trim()"),expected);
  // Hidden child windows can have a zero-size compositor; check bounds when laid out.
  if(await runner('innerWidth>0 && innerHeight>0')) assert.ok(await runner("(() => {const r=document.querySelector('[role=tooltip]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"));
  await runner("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await pause(30);
  assert.equal(await runner("!!document.querySelector('[role=tooltip]')"),false);
}
app.whenReady().then(async () => {
  try {
    ipcMain.handle('get-app-version', () => 'test');
    ipcMain.handle('open-directory-picker', () => fixture);
    ipcMain.handle('fs-readdir', async (_, p) => (await fs.promises.readdir(p, { withFileTypes: true })).map(e => ({ name: e.name, isDirectory: e.isDirectory() })));
    ipcMain.handle('fs-readfile', (_, p) => fs.promises.readFile(p, 'utf8'));
    ipcMain.handle('fs-writefile', (_, p, content) => fs.promises.writeFile(p, content));
    ipcMain.handle('fs-exists', (_, p) => fs.existsSync(p));
    const partition = 'wikilink-test-' + Date.now();
    win = new BrowserWindow({ show: false, width: 1100, height: 760, webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(root, 'electron/preload.cjs'), partition } });
    win.webContents.setWindowOpenHandler(()=>({action:'allow',overrideBrowserWindowOptions:{show:false,webPreferences:{preload:path.join(root,'electron/preload.cjs'),partition,offscreen:true,backgroundThrottling:false}}}));
    await win.loadFile(path.join(root, 'dist/index.html'));
    await until("!!document.querySelector('.open-vault-btn')");
    await js("document.querySelector('.open-vault-btn').click()");
    await until("!!document.querySelector('[data-tooltip=\"Source.md\"]')");
    await js("document.querySelector('[data-tooltip=\"Source.md\"]').closest('.tree-node-row').click()");
    await until("!!document.querySelector('.tiptap-editor')?.editor");
    for(let index=1;index<=3;index++) await checkTooltip('.sidebar-icon-btns button:nth-child('+index+')');
    await js("document.querySelector('.sidebar-icon-btns button').dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");
    await until("!!document.querySelector('[role=tooltip]')");
    await js("document.querySelector('.sidebar-icon-btns button').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))");
    await until("!document.querySelector('[role=tooltip]')");
    await reset(); await trigger('Be');
    await until("document.querySelectorAll('.wikilink-option:not(.wikilink-create)').length===2");
    assert.equal(await js("document.querySelectorAll('.wikilink-option-path').length"),0);
    await js("document.querySelector('.wikilink-option').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}))");
    await until("document.querySelector('[role=tooltip]')?.textContent.trim()==='Beta.md'");
    await js("document.querySelector('.wikilink-option').dispatchEvent(new PointerEvent('pointerout',{bubbles:true,pointerType:'mouse'}))");
    await press('ArrowDown'); await press('Enter');
    await until("!document.querySelector('.wikilink-menu')");
    assert.equal(await body(), '[[Better]]');
    await reset(); await trigger('한글 '); await press('Tab');
    assert.equal(await body(), '[[한글 노트]]');
    await reset(); await trigger('invalid/name');
    assert.equal(await js("document.querySelectorAll('.wikilink-option').length"), 0);
    assert.ok(await js("!!document.querySelector('.wikilink-empty')"));
    await press('Escape'); await until("!document.querySelector('.wikilink-menu')");
    assert.equal(await body(), '[[invalid/name]]');
    await reset(); await trigger('Same');
    await until("document.querySelectorAll('.wikilink-option:not(.wikilink-create)').length===2");
    assert.deepEqual(await js("[...document.querySelectorAll('.wikilink-option-path')].map(el=>el.textContent)"),['one','two']);
    await js("[...document.querySelectorAll('.wikilink-option')].find(el=>el.dataset.tooltip === 'two/Same.md').click()");
    assert.equal(await body(), '[[two/Same]]');
    await js("document.querySelector('.tiptap-editor').dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}))");
    for (let i=0;i<100;i++) { if(fs.readFileSync(path.join(fixture,'Source.md'),'utf8').includes('two/Same')) break; await pause(30); }
    assert.ok(fs.readFileSync(path.join(fixture,'Source.md'),'utf8').includes('two/Same'));
    await js("document.querySelectorAll('.sidebar-icon-btns button')[2].click()");
    await until("[...document.querySelectorAll('.graph-edge')].some(el=>el.__data__.target.id.endsWith('/two/Same.md'))");
    await js(`(() => {
      const link = document.querySelector('.wikilink');
      const rect = link.getBoundingClientRect();
      link.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,button:0,clientX:rect.x+2,clientY:rect.y+2}));
      link.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,button:0,clientX:rect.x+2,clientY:rect.y+2}));
    })()`);
    await until("document.querySelector('.tab-active')?.getAttribute('data-path')?.endsWith('/two/Same.md')");
    await js("document.querySelector('.backlinks-toggle').click()");
    await until("document.querySelectorAll('.backlink-result').length===1");
    assert.ok(await js("document.querySelector('.backlink-result').dataset.path.endsWith('/Source.md')"));
    assert.equal(await js("document.querySelector('.backlink-excerpt mark').textContent"), 'Same');
    await pause(150);
    fs.writeFileSync(path.join(root,'node_modules/.tmp/backlinks-panel.png'),(await win.webContents.capturePage()).toPNG());
    await js("document.querySelector('.backlink-result').click()");
    await until("document.querySelector('.tab-active')?.dataset.path.endsWith('/Source.md')");
    await until("document.querySelectorAll('.backlink-result').length===0");
    await reset(); await insert('No links now');
    await js("document.querySelector('.tab[data-path$=\"/two/Same.md\"]').click()");
    await until("document.querySelector('.tab-active')?.dataset.path.endsWith('/two/Same.md')");
    await until("document.querySelectorAll('.backlink-result').length===0");
    await js("document.querySelector('.backlinks-toggle').click()");
    await checkTooltip('.tab-active');
    await checkTooltip('.graph-node');
    assert.equal(await js("document.querySelector('.tab-active .tab-context').textContent"),' · two');
    assert.equal(await js("document.querySelector('.tab-active').dataset.tooltip"),'two/Same.md');
    await js("document.querySelector('.tab[data-path$=\"/Source.md\"]').click()");
    await until("document.querySelector('.tab-active')?.getAttribute('data-path')?.endsWith('/Source.md')");
    await reset(); await trigger('Same'); await pause(150);
    fs.writeFileSync(path.join(root,'node_modules/.tmp/duplicate-title-labels.png'),(await win.webContents.capturePage()).toPNG());
    await reset('codeBlock', '[[Be'); await pause(100);
    assert.equal(await js("!!document.querySelector('.wikilink-menu')"), false);
    await reset(); await trigger('Be');
    await js(`(() => {
      const el = document.querySelector('.tiptap-editor');
      el.dispatchEvent(new CompositionEvent('compositionstart', {bubbles:true}));
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true}));
    })()`);
    assert.equal(await body(), '[[Be]]');
    await js("document.querySelector('.tiptap-editor').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))");
    await pause(80);
    await press('Escape');
    await reset(); await insert('/'); await until("!!document.querySelector('.slash-menu')");
    await reset();
    await js("document.querySelector('.tiptap-editor').editor.commands.insertContent({type:'text',text:'[[Be',marks:[{type:'code'}]})");
    await pause(80);
    assert.equal(await js("!!document.querySelector('.wikilink-menu')"),false);
    await reset(); await trigger('Be');
    await pause(80);
    const bounds = await js("(() => {const r=document.querySelector('.wikilink-menu').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight}})()");
    assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.right<=bounds.w && bounds.bottom<=bounds.h);
    fs.writeFileSync(path.join(root,'node_modules/.tmp/wikilink-menu.png'),(await win.webContents.capturePage()).toPNG());
    await js("document.querySelector('.tiptap-editor').dispatchEvent(new FocusEvent('blur'))");
    await until("!document.querySelector('.wikilink-menu')");
    await reset(); await trigger('Be');
    await js("document.querySelector('.tab[data-path$=\"/two/Same.md\"]').click()");
    await until("!document.querySelector('.wikilink-menu')");
    assert.deepEqual(await js("[...document.querySelectorAll('.graph-label-context')].map(el=>el.textContent).sort()"),['one','two']);
    await js("document.querySelectorAll('.sidebar-icon-btns button')[0].click()");
    await until("!!document.querySelector('.search-input')");
    await js("(() => {const input=document.querySelector('.search-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Same');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await until("document.querySelectorAll('.search-result-path').length===2");
    assert.deepEqual(await js("[...document.querySelectorAll('.search-result-path')].map(el=>el.textContent).sort()"),['one','two']);
    await checkTooltip('.search-result-item');
    await js("document.querySelector('.graph-header-actions').lastElementChild.click()");
    let pip;
    for(let i=0;i<100;i++){pip=BrowserWindow.getAllWindows().find(w=>w!==win);if(pip)break;await pause(30);}
    assert.ok(pip);
    for(let i=0;i<100;i++){if(await pip.webContents.executeJavaScript("document.querySelectorAll('.graph-label-context').length===2"))break;await pause(30);}
    assert.deepEqual(await pip.webContents.executeJavaScript("[...document.querySelectorAll('.graph-label-context')].map(el=>el.textContent).sort()"),['one','two']);
    assert.ok(await pip.webContents.executeJavaScript("[...document.querySelectorAll('.graph-node[data-tooltip]')].some(el=>el.dataset.tooltip==='two/Same.md')"));
    await checkTooltip('.graph-node', code=>pip.webContents.executeJavaScript(code));
    assert.equal(await js("document.querySelectorAll('[title], svg title').length"),0);
    await js("(() => {const el=document.createElement('button');el.id='tooltip-long-path';el.dataset.tooltip='folder/'.repeat(25)+'Note.md';el.style.cssText='position:fixed;right:0;top:0';document.body.append(el)})()");
    await checkTooltip('#tooltip-long-path');
    await js("document.querySelector('#tooltip-long-path').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}))");
    await until("!!document.querySelector('[role=tooltip]')");
    await js("document.querySelector('#tooltip-long-path').remove()");
    await until("!document.querySelector('[role=tooltip]')");
    await js("document.querySelector('.tab[data-path$=\"/two/Same.md\"]').click()");
    await until("document.querySelector('.tab-active')?.dataset.path.endsWith('/two/Same.md')");
    const createdName = 'Created-' + Date.now();
    await reset(); await trigger(createdName);
    await until("!!document.querySelector('.wikilink-create')");
    await press('Enter');
    await until("!document.querySelector('.wikilink-menu')");
    assert.equal(await body(), '[[' + createdName + ']]');
    assert.equal(fs.readFileSync(path.join(fixture,'two',createdName+'.md'),'utf8'), '# '+createdName+'\n');
    await reset(); await trigger(createdName);
    assert.ok(await js("document.querySelector('.wikilink-menu').lastElementChild.classList.contains('wikilink-create')"));
    assert.ok(await js("document.querySelector('.wikilink-create').textContent.endsWith('(1)')"));
    await js("document.querySelector('.wikilink-create').click()");
    await until("!document.querySelector('.wikilink-menu')");
    assert.equal(await body(), '[[' + createdName + '(1)]]');
    assert.equal(fs.readFileSync(path.join(fixture,'two',createdName+'(1).md'),'utf8'), '# '+createdName+'(1)\n');
    await reset(); await trigger(createdName);
    assert.ok(await js("document.querySelector('.wikilink-create').textContent.endsWith('(2)')"));
    await press('Escape');
    for(const invalid of ['../escape','CON','bad:name','trailing.']) assert.equal(helpers.validNewNoteName(invalid),null);
    console.log('PASS: autocomplete, note creation in source folder, existing-note exclusion, invalid names, backlinks, graph and tooltips');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => app.exit(2), 45000);

