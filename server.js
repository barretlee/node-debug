'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const querystring = require('querystring');
const debugDemo = require('./debugClient');

const port = 4445;
http.createServer((req, res) => {
  router(req, res);
}).listen(port, () => {
  console.log(`Run Demo at: http://127.0.0.1:${port}`);
});

function router(req, res) {
  console.log(req.url);
  const [url, search] = req.url.split('?');
  const qs = querystring.parse(search);
  if (url === '/favicon.ico') {
    fs.createReadStream(
      path.join(__dirname, 'resource/assets/favicon.ico')
    ).pipe(res);
  } else if (url === '/') {
    let jsFile = fs.readFileSync(
      path.join(__dirname, 'resource/test.js')
    ).toString();
    let htmlFile = fs.readFileSync(
      path.join(__dirname, 'resource/index.html')
    ).toString();
    htmlFile = htmlFile.replace('{%content%}', jsFile);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlFile);
  } else if (url === '/debug') {
    if (debugDemo.running) {
      res.end('running');
      return;
    }
    debugDemo.run(qs, ({error, data}) => {
      res.end(JSON.stringify({ error, data }))
    });
  } else if (/^\/debug\//.test(url)) {
    if (!debugDemo.running) {
      res.end('not running');
      return;
    }
    const method = url.split('debug/')[1];
    if (debugDemo[method]) {
      debugDemo[method](qs, ({error, data}) => {
        res.end(JSON.stringify({ error, data }))
      });
    } else {
      res.end(JSON.stringify({ error: 'not found' }));
    }
  } else if (/^\/assets/.test(url)) {
    fs.createReadStream(
      path.join(__dirname, './resource' + url)
    ).pipe(res);
  } else {
    res.end('404');
  }
}