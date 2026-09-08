// Check the real tooltip layer in both app routes with nonzero viewports.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  try {
    for (const graphview of [false, true]) {
      const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true, backgroundThrottling: false, partition: 'tooltip-' + graphview + Date.now() } });
      await win.loadFile(path.resolve(__dirname, '../dist/index.html'), graphview ? { query: { graphview: '1' } } : {});
      const js = code => win.webContents.executeJavaScript(code);
      await pause(300);
      assert.ok(await js('innerWidth > 0 && innerHeight > 0'), 'A real viewport is required');
      await js(`(() => {
        const button = document.createElement('button');
        button.id = 'tooltip-probe';
        button.textContent = 'Hover';
        button.style.cssText = 'position:fixed;top:90px;width:24px;height:24px';
        document.body.append(button);
      })()`);
      for (const content of ['그래프를 새 창으로 열기', 'Folder/'.repeat(24) + 'Note.md']) {
        let baseline;
        for (const side of ['left', 'right', 'left', 'right']) {
          await js(`(() => {
            const button = document.querySelector('#tooltip-probe');
            button.style.left = ${JSON.stringify(side === 'left' ? '8px' : 'calc(100% - 32px)')};
            button.dataset.tooltip = ${JSON.stringify(content)};
            button.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
          })()`);
          await pause(150);
          const bounds = await js(`(() => {
            const tooltip = document.querySelector('[role=tooltip]');
            const rect = tooltip.getBoundingClientRect();
            return { width: rect.width, height: rect.height, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, vw: innerWidth, vh: innerHeight, text: tooltip.textContent.trim() };
          })()`);
          assert.equal(bounds.text, content);
          assert.ok(bounds.left >= 7 && bounds.right <= bounds.vw - 7 && bounds.top >= 0 && bounds.bottom <= bounds.vh, JSON.stringify(bounds));
          if (baseline) {
            assert.ok(Math.abs(bounds.width - baseline.width) < 1, 'Width changed with side: ' + JSON.stringify({ baseline, bounds }));
            assert.ok(Math.abs(bounds.height - baseline.height) < 1, 'Wrapping changed with side');
          }
          baseline = bounds;
          await js("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))");
          await pause(30);
        }
      }
      await js(`(() => {
        const button = document.querySelector('#tooltip-probe');
        button.dataset.tooltip = 'Drag graph';
        button.dataset.tooltipAnchor = 'pointer';
        button.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:150px';
      })()`);
      for (const [x, y] of [[200, 100], [300, 5]]) {
        await js(`document.querySelector('#tooltip-probe').dispatchEvent(new PointerEvent('pointerover', {bubbles:true,pointerType:'mouse',clientX:${x},clientY:${y}}))`);
        await pause(180);
        const rect = await js("document.querySelector('[role=tooltip]').getBoundingClientRect().toJSON()");
        assert.ok(Math.abs(rect.left + rect.width / 2 - x) < 1, 'Tooltip should anchor at the initial pointer position');
        assert.ok(Math.abs((y > 50 ? rect.bottom + 8 : rect.top - 8) - y) < 1, 'Tooltip should sit above the pointer or flip below near the top');
        await js(`(() => {
          const button = document.querySelector('#tooltip-probe');
          button.dispatchEvent(new PointerEvent('pointermove', {bubbles:true,pointerType:'mouse',clientX:500,clientY:50}));
          const child = document.createElement('span');
          button.append(child);
          button.dispatchEvent(new PointerEvent('pointerout', {bubbles:true,relatedTarget:child,clientX:500,clientY:50}));
          child.dispatchEvent(new PointerEvent('pointerover', {bubbles:true,relatedTarget:button,clientX:500,clientY:50}));
        })()`);
        await pause(180);
        assert.deepEqual(await js("document.querySelector('[role=tooltip]').getBoundingClientRect().toJSON()"), rect, 'Movement within the same trigger must not move the tooltip');
        if (y > 50) {
          await js("document.querySelector('#tooltip-probe').dispatchEvent(new PointerEvent('pointerout', {bubbles:true}))");
          await pause(30);
          assert.equal(await js("!!document.querySelector('[role=tooltip]')"), false);
        }
      }
      await js("document.querySelector('#tooltip-probe').dispatchEvent(new Event('dragstart', {bubbles:true}));document.querySelector('#tooltip-probe').dispatchEvent(new PointerEvent('pointermove', {bubbles:true,pointerType:'mouse',buttons:1,clientX:400,clientY:20}))");
      await pause(50);
      assert.equal(await js("!!document.querySelector('[role=tooltip]')"), false, 'Dragging hides the tooltip');
      win.destroy();
    }
    console.log('PASS: tooltip width, wrapping and viewport bounds at both edges in main and graph windows');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => app.exit(2), 30000);
