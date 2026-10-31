const BASE = 'http://127.0.0.1:3000';

// ---- F2: 安全响应头 ----
const hRes = await fetch(`${BASE}/health`);
const h = hRes.headers;
const want = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-dns-prefetch-control': 'off',
  'cross-origin-resource-policy': 'same-site',
};
let ok = true;
for (const [k, v] of Object.entries(want)) {
  const got = h.get(k);
  const pass = got === v;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} | F2 响应头 ${k} = ${got} (期望 ${v})`);
}
console.log(`${ok ? 'PASS' : 'FAIL'} | F2 安全响应头整体`);

// ---- F1: 搜索记录接口独立限流（20/min）----
let codes = [];
for (let i = 0; i < 25; i++) {
  const r = await fetch(`${BASE}/api/search/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: `限流测试${i}` }),
  });
  codes.push(r.status);
}
const first429 = codes.indexOf(429);
const okCount = codes.filter((c) => c === 200 || c === 201).length;
console.log(`F1 codes: ${codes.join(',')}`);
console.log(`${first429 === 20 && okCount === 20 ? 'PASS' : 'FAIL'} | F1 搜索记录限流：前 20 次通过，第 21 次起 429（首个 429 序号=${first429}, 通过数=${okCount}）`);