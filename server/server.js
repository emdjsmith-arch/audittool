const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { runChecks } = require('./checks');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Checks that automated tools genuinely cannot perform — shown to every
// user so the report never implies more coverage than it has.
const NOT_CHECKED = [
  {
    title: 'Whether alt text and link text actually make sense',
    detail: 'We can tell an image has alt text. We can\'t tell whether "IMG_4021.jpg" or "click here" is meaningful to someone who can\'t see the image.',
  },
  {
    title: 'Real keyboard navigation',
    detail: 'Whether every interactive element can actually be reached and operated using only a keyboard, in a sensible order, with no traps.',
  },
  {
    title: 'Whether focus is visible',
    detail: 'Automated tools can flag CSS that removes focus outlines, but confirming a visible focus indicator exists on every custom control needs a human tabbing through the page.',
  },
  {
    title: 'Screen reader experience',
    detail: 'How the page actually sounds and behaves with NVDA, JAWS, VoiceOver or TalkBack — including reading order, dynamic content announcements, and ARIA correctness beyond "is it present".',
  },
  {
    title: 'Captions, transcripts and audio description quality',
    detail: 'We can spot autoplaying media. We can\'t check whether captions exist, are accurate, or whether video needs audio description.',
  },
  {
    title: 'Plain language / cognitive accessibility',
    detail: 'Whether content is written clearly, avoids unnecessary jargon, and is structured for people with cognitive or learning disabilities.',
  },
  {
    title: 'PDFs and other documents',
    detail: 'This tool only checks the HTML page you give it — not PDFs, Word documents, or other files linked from it.',
  },
  {
    title: 'Forms: error handling and instructions',
    detail: 'Whether validation errors are announced properly, and whether required fields and formats are explained before someone submits a form.',
  },
  {
    title: 'Content behind logins, or content that loads after interaction',
    detail: 'We scan the page as it loads for an anonymous visitor. Anything behind authentication, or content that only appears after clicks, scrolling, or a delay, isn\'t included.',
  },
  {
    title: 'Touch target size and mobile usability',
    detail: 'Whether buttons and links are large enough and far enough apart for people with limited dexterity to tap accurately.',
  },
  {
    title: 'Timing, session timeouts, and motion/animation triggers',
    detail: 'Whether users get enough time to complete tasks, and whether flashing or moving content could trigger seizures or vestibular issues.',
  },
];

async function scanUrl(targetUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const response = await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });
    const status = response ? response.status() : null;
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    const issues = await page.evaluate(runChecks);
    await browser.close();
    return { ok: true, status, finalUrl, pageTitle, issues };
  } catch (err) {
    await browser.close().catch(() => {});
    return { ok: false, error: err.message };
  }
}

function severityCounts(issues) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  issues.forEach((i) => { if (counts[i.severity] !== undefined) counts[i.severity]++; });
  return counts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  // CORS (so the widget can be embedded / called from your WordPress domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/scan') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let targetUrl;
      try {
        targetUrl = JSON.parse(body).url;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid request body.' }));
      }
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Please provide a full URL starting with http:// or https://.' }));
      }
      const result = await scanUrl(targetUrl);
      if (!result.ok) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: `Couldn't load that page: ${result.error}` }));
      }
      const counts = severityCounts(result.issues);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        scannedUrl: targetUrl,
        finalUrl: result.finalUrl,
        pageTitle: result.pageTitle,
        httpStatus: result.status,
        scannedAt: new Date().toISOString(),
        counts,
        issues: result.issues,
        notChecked: NOT_CHECKED,
      }));
    });
    return;
  }

  // Static file serving for the frontend
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = filePath.split('?')[0];
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Accessibility checker running at http://localhost:${PORT}`);
});
