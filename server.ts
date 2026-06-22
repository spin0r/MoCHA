import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

interface LogEntry {
  method?: string;
  path?: string;
  type?: string;
  statusCode?: number;
  ip?: string | string[];
  userAgent?: string;
  error?: string;
  targetUrl?: string;
  requestRange?: string | null;
  bytesTransferred?: number;
  contentType?: string | null;
  contentLength?: string | null;
  durationMs?: number;
  timestamp?: string;
}

// ──────────────────────────────────────────────
//  In-memory request logs (capped at 1000)
// ──────────────────────────────────────────────
const MAX_LOGS = 1000;
const requestLogs: LogEntry[] = [];

function addLog(entry: LogEntry) {
  entry.timestamp = new Date().toISOString();
  requestLogs.unshift(entry); // newest first
  if (requestLogs.length > MAX_LOGS) requestLogs.length = MAX_LOGS;
  // Console log for Render.com dashboard visibility
  console.log(
    `[${entry.timestamp}] ${entry.method} ${entry.type} | ` +
    `status=${entry.statusCode || '---'} | ` +
    `target=${entry.targetUrl || entry.path} | ` +
    `ip=${entry.ip} | ua=${entry.userAgent}`
  );
}

// Extend Request to include _startTime
declare global {
  namespace Express {
    interface Request {
      _startTime?: number;
    }
  }
}

// ──────────────────────────────────────────────
//  Middleware: Log every request
// ──────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  req._startTime = Date.now();
  next();
});

// ──────────────────────────────────────────────
//  CORS headers for all responses
// ──────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Origin, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  next();
});

// ──────────────────────────────────────────────
//  Health check
// ──────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), logsCount: requestLogs.length });
});

// ──────────────────────────────────────────────
//  GET /api/logs — View request logs as JSON
//  Query params: ?limit=50&type=proxy&since=ISO_DATE
// ──────────────────────────────────────────────
app.get('/api/logs', (req: Request, res: Response) => {
  let logs = [...requestLogs];

  // Filter by type
  const type = req.query.type as string;
  if (type) {
    logs = logs.filter(l => l.type === type);
  }

  // Filter by since date
  const since = req.query.since as string;
  if (since) {
    const sinceDate = new Date(since);
    logs = logs.filter(l => new Date(l.timestamp!) >= sinceDate);
  }

  // Limit
  const limit = parseInt(req.query.limit as string) || 100;
  logs = logs.slice(0, limit);

  res.json({
    total: requestLogs.length,
    returned: logs.length,
    logs,
  });
});

// ──────────────────────────────────────────────
//  GET /api/logs/view — Pretty HTML log viewer
// ──────────────────────────────────────────────
app.get('/api/logs/view', (_req: Request, res: Response) => {
  res.send(generateLogViewerHTML());
});

// ──────────────────────────────────────────────
//  GET /api/logs/clear — Clear all logs
// ──────────────────────────────────────────────
app.post('/api/logs/clear', (_req: Request, res: Response) => {
  requestLogs.length = 0;
  res.json({ status: 'cleared' });
});

// ──────────────────────────────────────────────
//  VIDEO PROXY: /proxy?url=<encoded_video_url>
//  All video traffic routes through this server
// ──────────────────────────────────────────────
app.get('/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    addLog({
      method: req.method,
      path: req.originalUrl,
      type: 'proxy',
      statusCode: 400,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      error: 'Missing url parameter',
    });
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  // Build outgoing headers — forward Range for seeking support
  const outgoingHeaders: Record<string, string> = {
    'User-Agent': req.headers['user-agent'] || 'MoCHA-Proxy/1.0',
    'Accept': '*/*',
    'Accept-Encoding': 'identity', // No compression — stream raw bytes
    'Referer': new URL(targetUrl).origin + '/',
  };

  // Forward Range header for partial content / seeking
  if (req.headers.range) {
    outgoingHeaders['Range'] = req.headers.range;
  }

  const logEntry: LogEntry = {
    method: req.method,
    path: req.originalUrl,
    type: 'proxy',
    targetUrl,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    requestRange: req.headers.range || null,
    bytesTransferred: 0,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(targetUrl, {
      headers: outgoingHeaders,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    logEntry.statusCode = response.status;
    logEntry.contentType = response.headers.get('content-type');
    logEntry.contentLength = response.headers.get('content-length');

    // Forward important headers from the upstream response
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'etag',
      'last-modified',
    ];

    for (const header of headersToForward) {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    // Ensure the browser knows the real filename for "Save Video As..."
    let contentDisposition = response.headers.get('content-disposition');
    if (!contentDisposition) {
      try {
        const urlObj = new URL(targetUrl);
        let filename = urlObj.pathname.split('/').pop();
        if (filename) {
          filename = decodeURIComponent(filename).replace(/"/g, "'");
          contentDisposition = `inline; filename="${filename}"`;
        }
      } catch (e) { /* ignore */ }
    }
    
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    // Ensure accept-ranges is always set for seeking
    if (!response.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Set the status code (206 for partial content, etc.)
    res.status(response.status);

    // Pipe the response body to the client
    if (response.body) {
      // Create a node-compatible stream pipeline using readable-stream or similar if needed, 
      // but express 'res' can just use Web Streams with some adaptation
      const reader = response.body.getReader();
      let totalBytes = 0;

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.length;
            // Write chunk to response. If backpressure, wait.
            const canContinue = res.write(value);
            if (!canContinue) {
              await new Promise(resolve => res.once('drain', resolve));
            }
          }
          logEntry.bytesTransferred = totalBytes;
          logEntry.durationMs = Date.now() - (req._startTime || 0);
          addLog(logEntry);
          res.end();
        } catch (err: any) {
          // Client disconnected or upstream error
          logEntry.bytesTransferred = totalBytes;
          logEntry.error = err.message;
          logEntry.durationMs = Date.now() - (req._startTime || 0);
          addLog(logEntry);
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
        }
      };

      // Handle client disconnect
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      pump();
    } else {
      logEntry.durationMs = Date.now() - (req._startTime || 0);
      addLog(logEntry);
      res.end();
    }
  } catch (err: any) {
    logEntry.statusCode = 502;
    logEntry.error = err.message;
    logEntry.durationMs = Date.now() - (req._startTime || 0);
    addLog(logEntry);

    if (!res.headersSent) {
      res.status(502).json({
        error: 'Proxy fetch failed',
        message: err.message,
        targetUrl,
      });
    }
  }
});

// Handle OPTIONS preflight for proxy
app.options('/proxy', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Origin');
  res.status(204).end();
});

// ──────────────────────────────────────────────
//  Serve the built Vite frontend (static files)
// ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  setHeaders: (res: any, filePath: string) => {
    // Don't cache HTML — ensures SPA routing works
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback: serve index.html for any unmatched routes
// (supports /?v=VIDEO_URL style deep links)
app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
  // Skip API routes and static file requests (e.g. /favicon.ico)
  if (
    req.path.startsWith('/api') || 
    req.path.startsWith('/proxy') || 
    req.path.match(/\.[a-z0-9]+$/i)
  ) {
    next();
    return;
  }

  // Log page views
  addLog({
    method: req.method,
    path: req.originalUrl,
    type: 'page',
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    statusCode: 200,
    durationMs: Date.now() - (req._startTime || 0),
  });

  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ──────────────────────────────────────────────
//  Start server
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          MoCHA Proxy Server v1.0             ║
╠══════════════════════════════════════════════╣
║  Server    : http://localhost:${PORT}            ║
║  Proxy     : /proxy?url=<encoded_url>        ║
║  Logs JSON : /api/logs                       ║
║  Logs View : /api/logs/view                  ║
║  Health    : /api/health                     ║
╚══════════════════════════════════════════════╝
  `);
});

// ──────────────────────────────────────────────
//  Pretty HTML log viewer
// ──────────────────────────────────────────────
function generateLogViewerHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MoCHA — Server Logs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
      background: #0a0a0f;
      color: #c8ccd4;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 24px 32px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header h1 {
      font-size: 1.4rem;
      font-weight: 600;
      color: #e0e0e0;
    }
    .header h1 span { color: #7c83ff; }
    .stats {
      display: flex;
      gap: 16px;
      font-size: 0.85rem;
    }
    .stat {
      background: rgba(255,255,255,0.06);
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .stat .val { color: #7c83ff; font-weight: 700; }
    .controls {
      display: flex;
      gap: 8px;
      padding: 12px 32px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      flex-wrap: wrap;
    }
    .controls button, .controls select {
      background: rgba(255,255,255,0.06);
      color: #c8ccd4;
      border: 1px solid rgba(255,255,255,0.1);
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      font-family: inherit;
      transition: all 0.2s;
    }
    .controls button:hover { background: rgba(124,131,255,0.2); border-color: #7c83ff; }
    .controls .active { background: rgba(124,131,255,0.3); border-color: #7c83ff; color: #fff; }
    .log-container {
      padding: 16px 32px;
      max-width: 100%;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    th {
      position: sticky;
      top: 0;
      background: #12121a;
      color: #7c83ff;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.5px;
      border-bottom: 2px solid rgba(124,131,255,0.3);
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      vertical-align: top;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr:hover td { background: rgba(124,131,255,0.05); }
    .type-proxy { color: #5eead4; }
    .type-page { color: #a78bfa; }
    .status-2xx { color: #4ade80; }
    .status-3xx { color: #facc15; }
    .status-4xx { color: #fb923c; }
    .status-5xx { color: #f87171; }
    .url-cell {
      max-width: 500px;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .url-cell:hover { white-space: normal; word-break: break-all; color: #7c83ff; }
    .bytes { color: #7dd3fc; }
    .duration { color: #a78bfa; }
    .error-cell { color: #f87171; font-style: italic; }
    .empty-state {
      text-align: center;
      padding: 60px;
      color: #555;
      font-size: 1.1rem;
    }
    .live-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #4ade80;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1><span>⚡</span> MoCHA <span>Server Logs</span></h1>
    <div class="stats">
      <div class="stat"><span class="live-dot"></span>Live</div>
      <div class="stat">Total: <span class="val" id="totalCount">—</span></div>
      <div class="stat">Proxy: <span class="val" id="proxyCount">—</span></div>
      <div class="stat">Pages: <span class="val" id="pageCount">—</span></div>
    </div>
  </div>
  <div class="controls">
    <button class="active" data-filter="all">All</button>
    <button data-filter="proxy">Proxy Only</button>
    <button data-filter="page">Pages Only</button>
    <button data-filter="error">Errors</button>
    <button id="refreshBtn">↻ Refresh</button>
    <button id="autoRefresh" class="active">Auto-refresh: ON</button>
  </div>
  <div class="log-container">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Method</th>
          <th>Status</th>
          <th>Target / Path</th>
          <th>Bytes</th>
          <th>Duration</th>
          <th>IP</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody id="logBody"></tbody>
    </table>
    <div class="empty-state" id="emptyState">No logs yet. Play a video to see traffic.</div>
  </div>

  <script>
    let currentFilter = 'all';
    let autoRefreshEnabled = true;
    let refreshInterval = null;

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '—';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
      return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function statusClass(code) {
      if (!code) return '';
      if (code < 300) return 'status-2xx';
      if (code < 400) return 'status-3xx';
      if (code < 500) return 'status-4xx';
      return 'status-5xx';
    }

    function formatTime(iso) {
      const d = new Date(iso);
      return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
    }

    async function fetchLogs() {
      try {
        const res = await fetch('/api/logs?limit=200');
        const data = await res.json();

        document.getElementById('totalCount').textContent = data.total;

        let logs = data.logs;
        const proxyLogs = logs.filter(l => l.type === 'proxy');
        const pageLogs = logs.filter(l => l.type === 'page');
        document.getElementById('proxyCount').textContent = proxyLogs.length;
        document.getElementById('pageCount').textContent = pageLogs.length;

        if (currentFilter === 'proxy') logs = proxyLogs;
        else if (currentFilter === 'page') logs = pageLogs;
        else if (currentFilter === 'error') logs = logs.filter(l => l.error || (l.statusCode && l.statusCode >= 400));

        const tbody = document.getElementById('logBody');
        const empty = document.getElementById('emptyState');

        if (logs.length === 0) {
          tbody.innerHTML = '';
          empty.style.display = 'block';
          return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = logs.map(l => {
          const target = l.targetUrl || l.path || '—';
          return '<tr>' +
            '<td>' + formatTime(l.timestamp) + '</td>' +
            '<td class="type-' + l.type + '">' + (l.type || '—') + '</td>' +
            '<td>' + (l.method || '—') + '</td>' +
            '<td class="' + statusClass(l.statusCode) + '">' + (l.statusCode || '—') + '</td>' +
            '<td class="url-cell" title="' + target.replace(/"/g, '&quot;') + '">' + target + '</td>' +
            '<td class="bytes">' + formatBytes(l.bytesTransferred) + '</td>' +
            '<td class="duration">' + (l.durationMs ? l.durationMs + 'ms' : '—') + '</td>' +
            '<td>' + (l.ip || '—') + '</td>' +
            '<td class="error-cell">' + (l.error || '') + '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    }

    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        fetchLogs();
      });
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', fetchLogs);

    // Auto-refresh toggle
    const autoBtn = document.getElementById('autoRefresh');
    autoBtn.addEventListener('click', () => {
      autoRefreshEnabled = !autoRefreshEnabled;
      autoBtn.textContent = 'Auto-refresh: ' + (autoRefreshEnabled ? 'ON' : 'OFF');
      autoBtn.classList.toggle('active', autoRefreshEnabled);
      if (autoRefreshEnabled) {
        refreshInterval = setInterval(fetchLogs, 3000);
      } else {
        clearInterval(refreshInterval);
      }
    });

    // Initial load + auto-refresh
    fetchLogs();
    refreshInterval = setInterval(fetchLogs, 3000);
  </script>
</body>
</html>`;
}
