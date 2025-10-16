'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 3000;
const rootDir = process.cwd();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.map': 'application/json'
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Niet gevonden');
}

function streamFile(filePath, res) {
  const contentType = getContentType(filePath);
  const stream = fs.createReadStream(filePath);

  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
  });

  stream.on('error', () => send404(res));
  stream.pipe(res);
}

function handleRequest(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let relativePath = urlPath === '/' ? '/index.html' : urlPath;

  // Prevent path traversal
  const safePath = path.normalize(relativePath).replace(/^([.]{2}[\/])+/, '');
  const absolutePath = path.join(rootDir, safePath);

  fs.stat(absolutePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(absolutePath, 'index.html');
      fs.stat(indexPath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) return streamFile(indexPath, res);
        return send404(res);
      });
      return;
    }

    if (!err && stats.isFile()) {
      return streamFile(absolutePath, res);
    }

    return send404(res);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log('Kon browser niet automatisch openen. Ga naar:', url);
    }
  });
}

const server = http.createServer(handleRequest);

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`Server draait op ${url}`);
  openBrowser(url);
});
