'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ProtocalClient = require('./lib/protocolClient').ProtocolClient;

const debugFile = path.join(__dirname, 'resource/test.js');
const protocolClient = new ProtocalClient();

console.log('==== START DAP SERVER ===');
const debugAdaptorServer = cp.spawn('node', ['./vscode-node-debug2/out/src/nodeDebug.js'], { cwd: __dirname })

function on_exit() {
  debugAdaptorServer.kill('SIGINT');
  console.log('==== CLOSE DAP SERVER ===');
  process.exit(0);
}

process.on('SIGINT', on_exit);
process.on('exit', on_exit);

const debugDemo = module.exports = {

  running: false,
  isReady: false,
  threadId: null,

  run: async function (qs, cb) {
    this.running = true;

    protocolClient.connect(debugAdaptorServer.stdout, debugAdaptorServer.stdin);
    protocolClient.on('stopped', async event => {
      console.log('stopped', event);
      const threadId = debugDemo.threadId = event.body.threadId;
      await this.track(qs, cb);
    });
    protocolClient.on('initialized', async (data) => {
      console.log('initialized', data);
      setTimeout(() => {
        // 断点到 test.js 的 debugger 位置
        this.continue(qs, cb);
        // 模拟请求，触发断点
        setTimeout(() => {
          cp.exec('curl 127.0.0.1:8888');
        }, 50);
      }, 50);
    });

    await protocolClient.send('launch', { program: debugFile });
    await protocolClient.send('initialize', {
      adapterID: 'debug-demo',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path'
    });
    await protocolClient.send('configurationDone');
  },

  continue: async function (qs, cb) {
    await protocolClient.send('continue', { threadId: debugDemo.threadId });
    await this.track(qs, cb);
  },

  track: async function (qs, cb) {
    let trackEvent;
    try {
      trackEvent = await protocolClient.send('stackTrace', { threadId: debugDemo.threadId });
      cb && cb({
        error: '',
        data: trackEvent.body.stackFrames
      });
    } catch (e) {
      if (/No call stack available/.test(e.message)) {
        cb && cb({
          error: '',
          data: []
        });
      } else {
        cb && cb({
          error: e.message
        });
      }
    }
    return trackEvent;
  },

  evaluate: async function (qs, cb) {
    protocolClient.once('output', event => {
      if (/std/.test(event.body.category)) {
        if (event.body.source && /VM/i.test(event.body.source.name)) {
          cb && cb(event.body.output);
        }
      }
    });
    await protocolClient.send('evaluate', {
      expression: qs.expression,
      context: 'repl'
    });
  }

};