/**
 * 核心接口压测脚本（P2-16 · 16-4）
 *
 * 零第三方依赖，仅用 Node 内置模块，便于在任何环境（含 CI）直接运行。
 *
 * 用法：
 *   node scripts/loadtest.mjs                        # 默认 50 并发 20 秒
 *   node scripts/loadtest.mjs --concurrency 500 --duration 60
 *   node scripts/loadtest.mjs --base http://127.0.0.1:3000
 *   node scripts/loadtest.mjs --json report.json     # 额外输出 JSON 结果
 *
 * 参数：
 *   --base        后端基地址（默认 http://127.0.0.1:3000）
 *   --concurrency 并发数（默认 50）
 *   --duration    持续秒数（默认 20）
 *   --timeout     单请求超时毫秒（默认 5000）
 *   --json        结果 JSON 落盘路径（可选）
 *   --warmup      预热秒数（默认 3）
 *
 * 退出码：0 全部达标；1 存在错误或 P95 超阈值（默认 500ms）。
 */
import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { URL } from 'node:url';

// 核心只读接口（公开、无鉴权，代表读多写少的真实流量形态）
const ENDPOINTS = [
  { name: '健康检查', path: '/health' },
  { name: '分类树', path: '/api/library/categories' },
  { name: '书籍列表', path: '/api/library/books?page=1&pageSize=20' },
  { name: '动态流', path: '/api/feed?page=1&pageSize=10' },
  { name: '书评列表', path: '/api/community/reviews?page=1&pageSize=10' },
  { name: '热搜词', path: '/api/search/hot?limit=10' },
];

function parseArgs(argv) {
  const out = { base: 'http://127.0.0.1:3000', concurrency: 50, duration: 20, timeout: 5000, warmup: 3, json: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--duration') out.duration = Number(argv[++i]);
    else if (a === '--timeout') out.timeout = Number(argv[++i]);
    else if (a === '--warmup') out.warmup = Number(argv[++i]);
    else if (a === '--json') out.json = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const base = new URL(args.base);
const client = base.protocol === 'https:' ? https : http;

const stats = { total: 0, ok: 0, fail: 0, latencies: [], byEndpoint: new Map() };
for (const ep of ENDPOINTS) stats.byEndpoint.set(ep.name, { ok: 0, fail: 0, latencies: [] });

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function request(ep) {
  return new Promise((resolve) => {
    const started = performance.now();
    const req = client.request(
      {
        hostname: base.hostname,
        port: base.port || (base.protocol === 'https:' ? 443 : 80),
        path: ep.path,
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          const cost = performance.now() - started;
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          resolve({ ok, cost, status: res.statusCode });
        });
      },
    );
    req.setTimeout(args.timeout, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', () => resolve({ ok: false, cost: performance.now() - started, status: 0 }));
    req.end();
  });
}

async function worker(deadline) {
  while (performance.now() < deadline) {
    const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const r = await request(ep);
    stats.total++;
    const bucket = stats.byEndpoint.get(ep.name);
    if (r.ok) { stats.ok++; bucket.ok++; } else { stats.fail++; bucket.fail++; }
    stats.latencies.push(r.cost);
    bucket.latencies.push(r.cost);
  }
}

function summarize(latencies) {
  const s = [...latencies].sort((a, b) => a - b);
  return {
    avg: s.reduce((a, b) => a + b, 0) / (s.length || 1),
    p50: percentile(s, 50),
    p90: percentile(s, 90),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: s[s.length - 1] || 0,
  };
}

async function main() {
  console.log(`目标：${args.base}  并发：${args.concurrency}  时长：${args.duration}s  预热：${args.warmup}s`);
  console.log('接口：' + ENDPOINTS.map((e) => e.name).join(' / '));

  // 预热
  if (args.warmup > 0) {
    await Promise.all(Array.from({ length: args.concurrency }, () => worker(performance.now() + args.warmup * 1000)));
    stats.total = 0; stats.ok = 0; stats.fail = 0; stats.latencies = [];
    for (const ep of ENDPOINTS) stats.byEndpoint.set(ep.name, { ok: 0, fail: 0, latencies: [] });
    console.log('预热完成，开始正式压测…');
  }

  const deadline = performance.now() + args.duration * 1000;
  const wallStart = performance.now();
  await Promise.all(Array.from({ length: args.concurrency }, () => worker(deadline)));
  const wallSec = (performance.now() - wallStart) / 1000;

  const overall = summarize(stats.latencies);
  const rps = stats.total / wallSec;
  const errRate = stats.total ? (stats.fail / stats.total) * 100 : 0;

  console.log('\n===== 汇总 =====');
  console.log(`总请求：${stats.total}  成功：${stats.ok}  失败：${stats.fail}  错误率：${errRate.toFixed(2)}%`);
  console.log(`吞吐：${rps.toFixed(1)} req/s`);
  console.log(`延迟(ms)：avg=${overall.avg.toFixed(1)} p50=${overall.p50.toFixed(1)} p90=${overall.p90.toFixed(1)} p95=${overall.p95.toFixed(1)} p99=${overall.p99.toFixed(1)} max=${overall.max.toFixed(1)}`);

  console.log('\n===== 分接口 =====');
  const perEndpoint = {};
  for (const ep of ENDPOINTS) {
    const b = stats.byEndpoint.get(ep.name);
    const sum = summarize(b.latencies);
    perEndpoint[ep.name] = { ok: b.ok, fail: b.fail, ...sum };
    console.log(`${ep.name.padEnd(8)} ok=${b.ok} fail=${b.fail} p50=${sum.p50.toFixed(1)} p95=${sum.p95.toFixed(1)} p99=${sum.p99.toFixed(1)}`);
  }

  const P95_TARGET = 500;
  const pass = errRate < 1 && overall.p95 < P95_TARGET;
  console.log(`\n判定：P95 ${overall.p95.toFixed(1)}ms（阈值 ${P95_TARGET}ms）｜错误率 ${errRate.toFixed(2)}% → ${pass ? '达标 ✅' : '未达标 ❌'}`);

  if (args.json) {
    writeFileSync(
      args.json,
      JSON.stringify(
        { base: args.base, concurrency: args.concurrency, duration: args.duration, rps, errRate, overall, perEndpoint, pass },
        null,
        2,
      ),
    );
    console.log(`结果已写入 ${args.json}`);
  }
  process.exit(pass ? 0 : 1);
}

main();
