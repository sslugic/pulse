import http from 'node:http';
http.createServer((req, res) => {
  let b=''; req.on('data', c => b += c); req.on('end', () => {
    if (req.url.includes('gemini-broken')) { res.writeHead(500, {'Content-Type':'application/json'}); return res.end('{"error":{"message":"boom"}}'); }
    if (req.url.includes('streamGenerateContent')) {
      res.writeHead(200, {'Content-Type':'text/event-stream'});
      res.write('data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n');
      setTimeout(() => { res.write('data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n'); res.end(); }, 100);
      return;
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'mock ok, key=' + (req.headers['x-goog-api-key']||'') }] } }] }));
  });
}).listen(8787, () => console.log('mock on 8787'));
