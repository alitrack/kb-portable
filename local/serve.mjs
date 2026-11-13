import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const DATA = '/Users/sa/ws/kb-portable/data';
const webroot = '/Users/sa/ws/kb-portable';   // 与 Pages 根一致(仓库根 = 站点根: index.html/kb.duckdb/duckdb-wasm/data 都挂这里)
const MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.cjs': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.parquet': 'application/octet-stream', '.html': 'text/html', '.duckdb': 'application/octet-stream' };
// JEV 裁判端点: 默认指向本机 sglang(127.0.0.1:8014); 内网实例用 JUDGE_HOST/JUDGE_PORT 覆盖(值不入库)
const JUDGE = { host: process.env.JUDGE_HOST || '127.0.0.1', port: Number(process.env.JUDGE_PORT || 8014) };

// JEV 代理: 浏览器 -> 同源 /jev (免 CORS) -> 8014 (自动注入 thinking kwarg)
function proxyJudge(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body || '{}'); } catch { res.writeHead(400); return res.end('bad json'); }
    // 注入 thinking-model 适配(顶层 chat_template_kwargs; sglang 忽略 extra_body)
    payload.chat_template_kwargs = { ...(payload.chat_template_kwargs || {}), enable_thinking: false };
    // JEV 判分(0/1)由浏览器显式传 max_tokens:8;回答层传更大(如 600)
    if (payload.max_tokens === undefined) payload.max_tokens = 8;
    const data = JSON.stringify(payload);
    const up = http.request({
      host: JUDGE.host, port: JUDGE.port, path: '/v1/chat/completions',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, r => {
      let out = '';
      r.on('data', c => out += c);
      r.on('end', () => {
        res.writeHead(r.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(out);
      });
    });
    up.on('error', e => { res.writeHead(502, { 'Access-Control-Allow-Origin': '*' }); res.end('judge: ' + e.message); });
    up.write(data);
    up.end();
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/jev' && req.method === 'POST') return proxyJudge(req, res);
  if (url.pathname === '/jev' && req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }); return res.end(); }
  let p;
  if (url.pathname === '/') p = path.join(webroot, 'index.html');
  else if (url.pathname === '/favicon.ico') p = path.join(webroot, 'favicon.ico');
  else if (url.pathname === '/kb.duckdb') p = path.join(webroot, 'kb.duckdb');   // 包本体(与 Pages 同路径)
  else if (url.pathname.startsWith('/data/')) p = path.join(DATA, url.pathname.slice(6));
  else if (url.pathname.startsWith('/duckdb-wasm/')) p = path.join(webroot, 'duckdb-wasm', url.pathname.slice(13)); // 入库版(自包含 bundle + mvp wasm)
  else { res.writeHead(404); res.end('nf'); return; }
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('nf: ' + p); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(p).pipe(res);
});
server.listen(8210, '127.0.0.1', () => console.log('serving :8210'));
