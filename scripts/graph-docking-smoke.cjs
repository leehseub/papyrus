// Electron integration smoke test. Uses isolated storage and hidden windows.
// Drag events and external cursor position are simulated; physical OS dragging is a manual check.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'node_modules/.tmp');
const fixture = path.join(output, 'dock-vault');
fs.mkdirSync(fixture, {recursive:true});
fs.writeFileSync(path.join(fixture, 'Alpha.md'), '# Alpha\n[[Beta]]');
fs.writeFileSync(path.join(fixture, 'Beta.md'), '# Beta');
const pause = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
let main;
async function js(win, code) { return win.webContents.executeJavaScript(code); }
async function until(win, code) {
 for (let i=0;i<100;i++) { if (await js(win,code)) return; await pause(80); }
 throw new Error('Timed out '+code);
}
async function popup() {
 for (let i=0;i<100;i++) { const p = BrowserWindow.getAllWindows().find(w=>w!==main); if(p) { await until(p,"!!document.querySelector('.graph-drag-handle')"); return p; } await pause(80); }
 throw new Error('No popup');
}
function dragDropCode(side,source) { return `(() => {
 const area=document.querySelector('.main-area'), r=area.getBoundingClientRect();
 const dt=new DataTransfer(); dt.setData('application/x-papyrus-graph','${source}');
 const x=${side==='left'?'r.left+10':'r.right-10'}, y=r.top+70;
 area.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
 area.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
})()`; }
app.on('web-contents-created',(_,wc)=>wc.on('console-message',event=> { if(event.message?.includes('Uncaught')) errors.push(event.message); }));
app.whenReady().then(async()=>{
 try {
 const preload=path.join(root,'electron/preload.cjs');
 const preferences={preload,partition:'dock-test-'+Date.now()};
 ipcMain.handle('get-app-version',()=> '1.0.10');
 ipcMain.handle('open-directory-picker',()=>fixture);
 ipcMain.handle('fs-readdir',async(_,p)=>(await fs.promises.readdir(p,{withFileTypes:true})).map(e=>({name:e.name,isDirectory:e.isDirectory()})));
 ipcMain.handle('fs-readfile',(_,p)=>fs.promises.readFile(p,'utf8'));
 ipcMain.handle('fs-exists',(_,p)=>fs.existsSync(p));
 ipcMain.handle('graph-drag-position',()=>({point:{x:1600,y:100},bounds:{x:0,y:0,width:1200,height:800}}));
 main=new BrowserWindow({show:false,width:1200,height:800,webPreferences:preferences});
 main.webContents.setWindowOpenHandler(()=>({action:'allow',overrideBrowserWindowOptions:{show:false,webPreferences:preferences}}));
 await main.loadFile(path.join(root,'dist/index.html'));
 await until(main,"!!document.querySelector('.open-vault-btn')");
 await js(main,"document.querySelector('.open-vault-btn').click()");
 await until(main,"document.querySelector('.vault-name')?.textContent==='dock-vault'");
 await js(main,"document.querySelectorAll('.sidebar-icon-btns button')[2].click()");
 await until(main,"document.querySelectorAll('.graph-node').length===2");
 await js(main,dragDropCode('left','docked'));
 await until(main,"!!document.querySelector('.graph-panel-left')");
 const rects=await js(main,"({graph:document.querySelector('.graph-panel').getBoundingClientRect().x,editor:document.querySelector('.editor-area').getBoundingClientRect().x})");
 assert.ok(rects.graph<rects.editor);
 await js(main,`(() => {const r=document.querySelector('.graph-resizer').getBoundingClientRect();document.querySelector('.graph-resizer').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.x}));window.dispatchEvent(new MouseEvent('mousemove',{clientX:r.x+45}));window.dispatchEvent(new MouseEvent('mouseup'));})()`);
 await until(main,"JSON.parse(localStorage.getItem('papyrus-graph-layout')).width===325");
 await js(main,`(() => {
 const channel = new BroadcastChannel('papyrus-graph');
 const positions = Object.fromEntries([...document.querySelectorAll('.graph-node')].map((el,i)=>[el.__data__.id,{x:111+i*240,y:222}]));
 channel.postMessage({type:'nodePositions',data:positions}); channel.close();
 })()`);
 await until(main,"document.querySelector('.graph-node').__data__.x===111");
 await js(main,"document.querySelector('.graph-header-actions').lastElementChild.click()");
 let p=await popup();
 await until(main,"!document.querySelector('.graph-panel')");
 await until(p,"document.querySelectorAll('.graph-node').length===2");
 await until(p,"document.querySelector('.graph-node').__data__.x===111");
 assert.ok(p.webContents.getURL().includes('index.html?graphview=1'));
 await js(p,"document.querySelector('.graph-drag-handle').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}))");
 await js(main,dragDropCode('right','floating'));
 await until(main,"!!document.querySelector('.graph-panel-right') && document.querySelectorAll('.graph-node').length===2");
 await until(main,"document.querySelector('.graph-node').__data__.x===111");
 await pause(150); assert.ok(p.isDestroyed());
 // Native drag-end's external-position branch.
 await js(main,"document.querySelector('.graph-drag-handle').dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:new DataTransfer(),screenX:1600,screenY:100}))");
 p=await popup(); await until(p,"document.querySelectorAll('.graph-node').length===2");
 await js(p,"document.querySelector('.graph-header-actions button').click()");
 await until(main,"!!document.querySelector('.graph-panel-left')");
 await pause(150); assert.ok(p.isDestroyed());
 await main.reload();
 await until(main,"!!document.querySelector('.graph-panel-left')");
 assert.equal(await js(main,"document.querySelector('.graph-panel').getBoundingClientRect().width"),325);
 await js(main,"document.querySelectorAll('.sidebar-icon-btns button')[2].click()");
 await until(main,"!document.querySelector('.graph-panel')");
 assert.equal(await js(main,"JSON.parse(localStorage.getItem('papyrus-graph-layout')).mode"),'hidden');
 await js(main,"document.querySelectorAll('.sidebar-icon-btns button')[2].click()");
 await until(main,"!!document.querySelector('.graph-panel-left')");
 await until(main,"document.querySelectorAll('.graph-node').length===2");
 await pause(300);
 fs.writeFileSync(path.join(output,'graph-docking.png'),(await main.webContents.capturePage()).toPNG());
 await js(main,"document.querySelector('.graph-header-actions').lastElementChild.click()");
 p=await popup();
 await main.reload();
 await until(main,"!!document.querySelector('.open-vault-btn')");
 p=await popup();
 await until(main,"JSON.parse(localStorage.getItem('papyrus-graph-layout')).mode==='floating' && !document.querySelector('.graph-panel')");
 p.close();
 await until(main,"JSON.parse(localStorage.getItem('papyrus-graph-layout')).mode==='hidden'");
 assert.deepEqual(errors,[]);
 console.log('PASS: docking, resizing, detach/redock, node positions, popup URL, docked/floating layout restore, collapse and popup close');
 app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
setTimeout(()=>app.exit(2),45000);
