'use strict';

let http = require('http');

const server = http.createServer((req, res) => {
  res.end('hi');
});

server.listen(8888, () => {
  console.log('start server');
});