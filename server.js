"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var path_1 = require("path");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
var app = (0, express_1.default)();
var PORT = process.env.PORT || 3000;
// ──────────────────────────────────────────────
//  In-memory request logs (capped at 1000)
// ──────────────────────────────────────────────
var MAX_LOGS = 1000;
var requestLogs = [];
function addLog(entry) {
    entry.timestamp = new Date().toISOString();
    requestLogs.unshift(entry); // newest first
    if (requestLogs.length > MAX_LOGS)
        requestLogs.length = MAX_LOGS;
    // Console log for Render.com dashboard visibility
    console.log("[".concat(entry.timestamp, "] ").concat(entry.method, " ").concat(entry.type, " | ") +
        "status=".concat(entry.statusCode || '---', " | ") +
        "target=".concat(entry.targetUrl || entry.path, " | ") +
        "ip=".concat(entry.ip, " | ua=").concat(entry.userAgent));
}
// ──────────────────────────────────────────────
//  Middleware: Log every request
// ──────────────────────────────────────────────
app.use(function (req, _res, next) {
    req._startTime = Date.now();
    next();
});
// ──────────────────────────────────────────────
//  CORS headers for all responses
// ──────────────────────────────────────────────
app.use(function (_req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Origin, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    next();
});
// ──────────────────────────────────────────────
//  Health check
// ──────────────────────────────────────────────
app.get('/api/health', function (_req, res) {
    res.json({ status: 'ok', uptime: process.uptime(), logsCount: requestLogs.length });
});
// ──────────────────────────────────────────────
//  GET /api/logs — View request logs as JSON
//  Query params: ?limit=50&type=proxy&since=ISO_DATE
// ──────────────────────────────────────────────
app.get('/api/logs', function (req, res) {
    var logs = __spreadArray([], requestLogs, true);
    // Filter by type
    var type = req.query.type;
    if (type) {
        logs = logs.filter(function (l) { return l.type === type; });
    }
    // Filter by since date
    var since = req.query.since;
    if (since) {
        var sinceDate_1 = new Date(since);
        logs = logs.filter(function (l) { return new Date(l.timestamp) >= sinceDate_1; });
    }
    // Limit
    var limit = parseInt(req.query.limit) || 100;
    logs = logs.slice(0, limit);
    res.json({
        total: requestLogs.length,
        returned: logs.length,
        logs: logs,
    });
});
// ──────────────────────────────────────────────
//  GET /api/logs/view — Pretty HTML log viewer
// ──────────────────────────────────────────────
app.get('/api/logs/view', function (_req, res) {
    res.send(generateLogViewerHTML());
});
// ──────────────────────────────────────────────
//  GET /api/logs/clear — Clear all logs
// ──────────────────────────────────────────────
app.post('/api/logs/clear', function (_req, res) {
    requestLogs.length = 0;
    res.json({ status: 'cleared' });
});
// ──────────────────────────────────────────────
//  VIDEO PROXY: /proxy?url=<encoded_video_url>
//  All video traffic routes through this server
// ──────────────────────────────────────────────
app.get('/proxy', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUrl, outgoingHeaders, logEntry, controller_1, timeout, response, headersToForward, _i, headersToForward_1, header, value, reader_1, totalBytes_1, pump, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                targetUrl = req.query.url;
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
                    return [2 /*return*/];
                }
                outgoingHeaders = {
                    'User-Agent': req.headers['user-agent'] || 'MoCHA-Proxy/1.0',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity', // No compression — stream raw bytes
                    'Referer': new URL(targetUrl).origin + '/',
                };
                // Forward Range header for partial content / seeking
                if (req.headers.range) {
                    outgoingHeaders['Range'] = req.headers.range;
                }
                logEntry = {
                    method: req.method,
                    path: req.originalUrl,
                    type: 'proxy',
                    targetUrl: targetUrl,
                    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown',
                    requestRange: req.headers.range || null,
                    bytesTransferred: 0,
                };
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                controller_1 = new AbortController();
                timeout = setTimeout(function () { return controller_1.abort(); }, 30000);
                return [4 /*yield*/, fetch(targetUrl, {
                        headers: outgoingHeaders,
                        signal: controller_1.signal,
                        redirect: 'follow',
                    })];
            case 2:
                response = _a.sent();
                clearTimeout(timeout);
                logEntry.statusCode = response.status;
                logEntry.contentType = response.headers.get('content-type');
                logEntry.contentLength = response.headers.get('content-length');
                headersToForward = [
                    'content-type',
                    'content-length',
                    'content-range',
                    'accept-ranges',
                    'content-disposition',
                    'cache-control',
                    'etag',
                    'last-modified',
                ];
                for (_i = 0, headersToForward_1 = headersToForward; _i < headersToForward_1.length; _i++) {
                    header = headersToForward_1[_i];
                    value = response.headers.get(header);
                    if (value) {
                        res.setHeader(header, value);
                    }
                }
                // Ensure accept-ranges is always set for seeking
                if (!response.headers.get('accept-ranges')) {
                    res.setHeader('Accept-Ranges', 'bytes');
                }
                // Set the status code (206 for partial content, etc.)
                res.status(response.status);
                // Pipe the response body to the client
                if (response.body) {
                    reader_1 = response.body.getReader();
                    totalBytes_1 = 0;
                    pump = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, done, value, canContinue, err_2;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 6, , 7]);
                                    _b.label = 1;
                                case 1:
                                    if (!true) return [3 /*break*/, 5];
                                    return [4 /*yield*/, reader_1.read()];
                                case 2:
                                    _a = _b.sent(), done = _a.done, value = _a.value;
                                    if (done)
                                        return [3 /*break*/, 5];
                                    totalBytes_1 += value.length;
                                    canContinue = res.write(value);
                                    if (!!canContinue) return [3 /*break*/, 4];
                                    return [4 /*yield*/, new Promise(function (resolve) { return res.once('drain', resolve); })];
                                case 3:
                                    _b.sent();
                                    _b.label = 4;
                                case 4: return [3 /*break*/, 1];
                                case 5:
                                    logEntry.bytesTransferred = totalBytes_1;
                                    logEntry.durationMs = Date.now() - (req._startTime || 0);
                                    addLog(logEntry);
                                    res.end();
                                    return [3 /*break*/, 7];
                                case 6:
                                    err_2 = _b.sent();
                                    // Client disconnected or upstream error
                                    logEntry.bytesTransferred = totalBytes_1;
                                    logEntry.error = err_2.message;
                                    logEntry.durationMs = Date.now() - (req._startTime || 0);
                                    addLog(logEntry);
                                    if (!res.headersSent) {
                                        res.status(502).end();
                                    }
                                    else {
                                        res.end();
                                    }
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); };
                    // Handle client disconnect
                    req.on('close', function () {
                        reader_1.cancel().catch(function () { });
                    });
                    pump();
                }
                else {
                    logEntry.durationMs = Date.now() - (req._startTime || 0);
                    addLog(logEntry);
                    res.end();
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                logEntry.statusCode = 502;
                logEntry.error = err_1.message;
                logEntry.durationMs = Date.now() - (req._startTime || 0);
                addLog(logEntry);
                if (!res.headersSent) {
                    res.status(502).json({
                        error: 'Proxy fetch failed',
                        message: err_1.message,
                        targetUrl: targetUrl,
                    });
                }
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Handle OPTIONS preflight for proxy
app.options('/proxy', function (_req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Origin');
    res.status(204).end();
});
// ──────────────────────────────────────────────
//  Serve the built Vite frontend (static files)
// ──────────────────────────────────────────────
app.use(express_1.default.static(path_1.default.join(__dirname, 'dist'), {
    maxAge: '1d',
    setHeaders: function (res, filePath) {
        // Don't cache HTML — ensures SPA routing works
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
}));
// SPA fallback: serve index.html for any unmatched routes
// (supports /?v=VIDEO_URL style deep links)
app.get(/.*/, function (req, res, next) {
    // Skip API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/proxy')) {
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
    res.sendFile(path_1.default.join(__dirname, 'dist', 'index.html'));
});
// ──────────────────────────────────────────────
//  Start server
// ──────────────────────────────────────────────
app.listen(PORT, function () {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551          MoCHA Proxy Server v1.0             \u2551\n\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n\u2551  Server    : http://localhost:".concat(PORT, "            \u2551\n\u2551  Proxy     : /proxy?url=<encoded_url>        \u2551\n\u2551  Logs JSON : /api/logs                       \u2551\n\u2551  Logs View : /api/logs/view                  \u2551\n\u2551  Health    : /api/health                     \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n  "));
});
// ──────────────────────────────────────────────
//  Pretty HTML log viewer
// ──────────────────────────────────────────────
function generateLogViewerHTML() {
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>MoCHA \u2014 Server Logs</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body {\n      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;\n      background: #0a0a0f;\n      color: #c8ccd4;\n      min-height: 100vh;\n    }\n    .header {\n      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);\n      padding: 24px 32px;\n      border-bottom: 1px solid rgba(255,255,255,0.08);\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      flex-wrap: wrap;\n      gap: 12px;\n    }\n    .header h1 {\n      font-size: 1.4rem;\n      font-weight: 600;\n      color: #e0e0e0;\n    }\n    .header h1 span { color: #7c83ff; }\n    .stats {\n      display: flex;\n      gap: 16px;\n      font-size: 0.85rem;\n    }\n    .stat {\n      background: rgba(255,255,255,0.06);\n      padding: 6px 14px;\n      border-radius: 6px;\n      border: 1px solid rgba(255,255,255,0.08);\n    }\n    .stat .val { color: #7c83ff; font-weight: 700; }\n    .controls {\n      display: flex;\n      gap: 8px;\n      padding: 12px 32px;\n      background: rgba(255,255,255,0.02);\n      border-bottom: 1px solid rgba(255,255,255,0.05);\n      flex-wrap: wrap;\n    }\n    .controls button, .controls select {\n      background: rgba(255,255,255,0.06);\n      color: #c8ccd4;\n      border: 1px solid rgba(255,255,255,0.1);\n      padding: 6px 14px;\n      border-radius: 6px;\n      cursor: pointer;\n      font-size: 0.82rem;\n      font-family: inherit;\n      transition: all 0.2s;\n    }\n    .controls button:hover { background: rgba(124,131,255,0.2); border-color: #7c83ff; }\n    .controls .active { background: rgba(124,131,255,0.3); border-color: #7c83ff; color: #fff; }\n    .log-container {\n      padding: 16px 32px;\n      max-width: 100%;\n      overflow-x: auto;\n    }\n    table {\n      width: 100%;\n      border-collapse: collapse;\n      font-size: 0.8rem;\n    }\n    th {\n      position: sticky;\n      top: 0;\n      background: #12121a;\n      color: #7c83ff;\n      text-align: left;\n      padding: 10px 12px;\n      font-weight: 600;\n      text-transform: uppercase;\n      font-size: 0.7rem;\n      letter-spacing: 0.5px;\n      border-bottom: 2px solid rgba(124,131,255,0.3);\n    }\n    td {\n      padding: 8px 12px;\n      border-bottom: 1px solid rgba(255,255,255,0.04);\n      vertical-align: top;\n      max-width: 400px;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n    tr:hover td { background: rgba(124,131,255,0.05); }\n    .type-proxy { color: #5eead4; }\n    .type-page { color: #a78bfa; }\n    .status-2xx { color: #4ade80; }\n    .status-3xx { color: #facc15; }\n    .status-4xx { color: #fb923c; }\n    .status-5xx { color: #f87171; }\n    .url-cell {\n      max-width: 500px;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      cursor: pointer;\n    }\n    .url-cell:hover { white-space: normal; word-break: break-all; color: #7c83ff; }\n    .bytes { color: #7dd3fc; }\n    .duration { color: #a78bfa; }\n    .error-cell { color: #f87171; font-style: italic; }\n    .empty-state {\n      text-align: center;\n      padding: 60px;\n      color: #555;\n      font-size: 1.1rem;\n    }\n    .live-dot {\n      display: inline-block;\n      width: 8px; height: 8px;\n      border-radius: 50%;\n      background: #4ade80;\n      margin-right: 8px;\n      animation: pulse 2s infinite;\n    }\n    @keyframes pulse {\n      0%, 100% { opacity: 1; }\n      50% { opacity: 0.3; }\n    }\n  </style>\n</head>\n<body>\n  <div class=\"header\">\n    <h1><span>\u26A1</span> MoCHA <span>Server Logs</span></h1>\n    <div class=\"stats\">\n      <div class=\"stat\"><span class=\"live-dot\"></span>Live</div>\n      <div class=\"stat\">Total: <span class=\"val\" id=\"totalCount\">\u2014</span></div>\n      <div class=\"stat\">Proxy: <span class=\"val\" id=\"proxyCount\">\u2014</span></div>\n      <div class=\"stat\">Pages: <span class=\"val\" id=\"pageCount\">\u2014</span></div>\n    </div>\n  </div>\n  <div class=\"controls\">\n    <button class=\"active\" data-filter=\"all\">All</button>\n    <button data-filter=\"proxy\">Proxy Only</button>\n    <button data-filter=\"page\">Pages Only</button>\n    <button data-filter=\"error\">Errors</button>\n    <button id=\"refreshBtn\">\u21BB Refresh</button>\n    <button id=\"autoRefresh\" class=\"active\">Auto-refresh: ON</button>\n  </div>\n  <div class=\"log-container\">\n    <table>\n      <thead>\n        <tr>\n          <th>Time</th>\n          <th>Type</th>\n          <th>Method</th>\n          <th>Status</th>\n          <th>Target / Path</th>\n          <th>Bytes</th>\n          <th>Duration</th>\n          <th>IP</th>\n          <th>Error</th>\n        </tr>\n      </thead>\n      <tbody id=\"logBody\"></tbody>\n    </table>\n    <div class=\"empty-state\" id=\"emptyState\">No logs yet. Play a video to see traffic.</div>\n  </div>\n\n  <script>\n    let currentFilter = 'all';\n    let autoRefreshEnabled = true;\n    let refreshInterval = null;\n\n    function formatBytes(bytes) {\n      if (!bytes || bytes === 0) return '\u2014';\n      if (bytes < 1024) return bytes + ' B';\n      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';\n      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';\n      return (bytes / 1073741824).toFixed(2) + ' GB';\n    }\n\n    function statusClass(code) {\n      if (!code) return '';\n      if (code < 300) return 'status-2xx';\n      if (code < 400) return 'status-3xx';\n      if (code < 500) return 'status-4xx';\n      return 'status-5xx';\n    }\n\n    function formatTime(iso) {\n      const d = new Date(iso);\n      return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');\n    }\n\n    async function fetchLogs() {\n      try {\n        const res = await fetch('/api/logs?limit=200');\n        const data = await res.json();\n\n        document.getElementById('totalCount').textContent = data.total;\n\n        let logs = data.logs;\n        const proxyLogs = logs.filter(l => l.type === 'proxy');\n        const pageLogs = logs.filter(l => l.type === 'page');\n        document.getElementById('proxyCount').textContent = proxyLogs.length;\n        document.getElementById('pageCount').textContent = pageLogs.length;\n\n        if (currentFilter === 'proxy') logs = proxyLogs;\n        else if (currentFilter === 'page') logs = pageLogs;\n        else if (currentFilter === 'error') logs = logs.filter(l => l.error || (l.statusCode && l.statusCode >= 400));\n\n        const tbody = document.getElementById('logBody');\n        const empty = document.getElementById('emptyState');\n\n        if (logs.length === 0) {\n          tbody.innerHTML = '';\n          empty.style.display = 'block';\n          return;\n        }\n        empty.style.display = 'none';\n\n        tbody.innerHTML = logs.map(l => {\n          const target = l.targetUrl || l.path || '\u2014';\n          return '<tr>' +\n            '<td>' + formatTime(l.timestamp) + '</td>' +\n            '<td class=\"type-' + l.type + '\">' + (l.type || '\u2014') + '</td>' +\n            '<td>' + (l.method || '\u2014') + '</td>' +\n            '<td class=\"' + statusClass(l.statusCode) + '\">' + (l.statusCode || '\u2014') + '</td>' +\n            '<td class=\"url-cell\" title=\"' + target.replace(/\"/g, '&quot;') + '\">' + target + '</td>' +\n            '<td class=\"bytes\">' + formatBytes(l.bytesTransferred) + '</td>' +\n            '<td class=\"duration\">' + (l.durationMs ? l.durationMs + 'ms' : '\u2014') + '</td>' +\n            '<td>' + (l.ip || '\u2014') + '</td>' +\n            '<td class=\"error-cell\">' + (l.error || '') + '</td>' +\n          '</tr>';\n        }).join('');\n      } catch (err) {\n        console.error('Failed to fetch logs:', err);\n      }\n    }\n\n    // Filter buttons\n    document.querySelectorAll('[data-filter]').forEach(btn => {\n      btn.addEventListener('click', () => {\n        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));\n        btn.classList.add('active');\n        currentFilter = btn.dataset.filter;\n        fetchLogs();\n      });\n    });\n\n    // Refresh button\n    document.getElementById('refreshBtn').addEventListener('click', fetchLogs);\n\n    // Auto-refresh toggle\n    const autoBtn = document.getElementById('autoRefresh');\n    autoBtn.addEventListener('click', () => {\n      autoRefreshEnabled = !autoRefreshEnabled;\n      autoBtn.textContent = 'Auto-refresh: ' + (autoRefreshEnabled ? 'ON' : 'OFF');\n      autoBtn.classList.toggle('active', autoRefreshEnabled);\n      if (autoRefreshEnabled) {\n        refreshInterval = setInterval(fetchLogs, 3000);\n      } else {\n        clearInterval(refreshInterval);\n      }\n    });\n\n    // Initial load + auto-refresh\n    fetchLogs();\n    refreshInterval = setInterval(fetchLogs, 3000);\n  </script>\n</body>\n</html>";
}
