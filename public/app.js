// ---- Configuration: fill this in before going live ----
const APPRENTICESHIP_URL = 'https://example.com/apprenticeships/digital-accessibility-specialist-level-4'; // TODO: replace with your real page

const form = document.getElementById('scan-form');
const statusEl = document.getElementById('status');
const reportEl = document.getElementById('report');
const btn = document.getElementById('scan-btn');

const SEVERITY_LABEL = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('url-input').value.trim();
  if (!url) return;

  reportEl.hidden = true;
  reportEl.innerHTML = '';
  statusEl.hidden = false;
  statusEl.className = 'status loading';
  statusEl.textContent = `Scanning ${url} — this usually takes 10–30 seconds…`;
  btn.disabled = true;

  try {
    const res = await fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!data.ok) {
      statusEl.className = 'status error';
      statusEl.textContent = data.error || 'Something went wrong while scanning that page.';
      return;
    }

    statusEl.hidden = true;
    renderReport(data);
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Could not reach the scanner. Please try again in a moment.';
  } finally {
    btn.disabled = false;
  }
});

function renderReport(data) {
  const { counts, issues, notChecked, scannedUrl, pageTitle, scannedAt } = data;
  const total = counts.critical + counts.serious + counts.moderate + counts.minor;

  const order = ['critical', 'serious', 'moderate', 'minor'];
  const grouped = {};
  order.forEach((s) => (grouped[s] = issues.filter((i) => i.severity === s)));

  let html = '';

  html += `<div class="report-header">
    <h2>Results for: ${escapeHtml(pageTitle || scannedUrl)}</h2>
    <div class="scanned-url">${escapeHtml(scannedUrl)} · scanned ${new Date(scannedAt).toLocaleString('en-GB')}</div>
    <div class="counts">
      ${total === 0
        ? `<div class="count-pill clean"><span class="n">0</span>issues found</div>`
        : order.map((s) => `<div class="count-pill ${s}"><span class="n">${counts[s]}</span>${SEVERITY_LABEL[s]}</div>`).join('')}
    </div>
  </div>`;

  if (total === 0) {
    html += `<div class="clean-message">No issues found by our automated checks — but please read "What this tool didn't check" below. A clean automated scan is a good sign, not a certificate of full accessibility.</div>`;
  } else {
    html += `<h2 class="section-title">Issues found</h2>`;
    order.forEach((sev) => {
      grouped[sev].forEach((issue) => {
        html += renderIssue(issue, sev);
      });
    });
  }

  html += renderNotChecked(notChecked);
  html += renderCta();

  reportEl.innerHTML = html;
  reportEl.hidden = false;
  reportEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderIssue(issue) {
  return `<div class="issue ${issue.severity}">
    <div class="issue-top">
      <h3>${escapeHtml(issue.title)}</h3>
      <span class="badge ${issue.severity}">${SEVERITY_LABEL[issue.severity]}</span>
    </div>
    <div class="wcag-ref">WCAG ${escapeHtml(issue.wcag)}</div>
    <p>${escapeHtml(issue.description)}</p>
    <div class="fix"><strong>Suggested fix:</strong> ${escapeHtml(issue.fix)}</div>
    ${issue.selector ? `<div class="example">${escapeHtml(issue.selector)}${issue.html ? '\n' + escapeHtml(issue.html) : ''}</div>` : ''}
    ${issue.caveat ? `<p class="caveat">Note: ${escapeHtml(issue.caveat)}</p>` : ''}
  </div>`;
}

function renderNotChecked(notChecked) {
  return `<div class="not-checked">
    <h2>What this tool didn't check</h2>
    <p>Automated scanners like this one can only catch part of what makes a site genuinely accessible — <strong>roughly a third of WCAG success criteria can be reliably tested by software</strong>. Everything below needs a trained human to assess properly:</p>
    <ul>
      ${notChecked.map((item) => `<li><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.detail)}</li>`).join('')}
    </ul>
  </div>`;
}

function renderCta() {
  return `<div class="cta">
    <h2>Want this done properly?</h2>
    <p>A full accessibility audit means combining automated scans like this one with real assistive-technology testing and expert manual review — exactly what a trained Digital Accessibility Specialist does. If your organisation wants that expertise in-house, our Level 4 Digital Accessibility Specialist apprenticeship trains people to do this work to a professional standard.</p>
    <a class="button" href="${APPRENTICESHIP_URL}" target="_blank" rel="noopener">Explore the Digital Accessibility Specialist apprenticeship →</a>
  </div>`;
}
