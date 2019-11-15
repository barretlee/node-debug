'use strict';

let http = require('http');

console.log('[log] entry');

const server = http.createServer((req, res) => {
  res.write('[log] hello\n');
  setTimeout(() => {
    debugger;
    res.end('[log] world');
  }, 0);
});

server.listen(8888, () => {
  console.log('[log] start server');
});