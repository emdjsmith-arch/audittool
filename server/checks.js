/**
 * Accessibility checks — run inside the page via page.evaluate().
 *
 * These are automated, DOM/CSS-based checks. Each one maps to a WCAG 2.2
 * success criterion and is written to be transparent about what it looks
 * for and where it can be wrong (see `caveat` on each result group).
 *
 * IMPORTANT: this file's default export is a function that gets serialised
 * and run INSIDE the browser page — it cannot use anything from Node
 * (no require, no imports, no closures over outer variables).
 */

function runChecks() {
  const issues = []; // { id, title, severity, wcag, description, fix, selector, html, caveat }

  function addIssue(base, els) {
    els.forEach((el) => {
      issues.push({
        ...base,
        selector: describeElement(el),
        html: truncate(el.outerHTML, 200),
      });
    });
  }

  function describeElement(el) {
    if (!el || !el.tagName) return '(unknown element)';
    let sel = el.tagName.toLowerCase();
    if (el.id) sel += `#${el.id}`;
    else if (el.className && typeof el.className === 'string' && el.className.trim()) {
      sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return sel;
  }

  function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function accessibleNameLength(el) {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim().length;
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const ref = document.getElementById(labelledby);
      if (ref && ref.textContent.trim()) return ref.textContent.trim().length;
    }
    const text = (el.textContent || '').trim();
    if (text) return text.length;
    const img = el.querySelector && el.querySelector('img[alt]');
    if (img && img.getAttribute('alt') && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim().length;
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim().length;
    return 0;
  }

  // ---- 1. Images missing alt text (WCAG 1.1.1) ----
  {
    const imgs = Array.from(document.querySelectorAll('img')).filter(isVisible);
    const missing = imgs.filter((img) => !img.hasAttribute('alt'));
    if (missing.length) {
      addIssue({
        id: 'img-alt-missing',
        title: 'Images missing an alt attribute',
        severity: 'critical',
        wcag: '1.1.1 Non-text Content (Level A)',
        description: 'These images have no alt attribute at all, so screen readers announce the filename or "unlabelled image" instead of useful information.',
        fix: 'Add alt="" for purely decorative images, or a short, meaningful alt describing the image\'s purpose for everything else.',
        caveat: 'This only checks that alt exists — it cannot judge whether existing alt text is actually meaningful.',
      }, missing);
    }
  }

  // ---- 2. Form fields without a label (WCAG 1.3.1 / 4.1.2) ----
  {
    const fields = Array.from(
      document.querySelectorAll('input, textarea, select')
    ).filter((el) => {
      if (!isVisible(el)) return false;
      const type = (el.getAttribute('type') || '').toLowerCase();
      return !['hidden', 'submit', 'button', 'image', 'reset'].includes(type);
    });
    const unlabelled = fields.filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return false;
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label && label.textContent.trim()) return false;
      }
      const parentLabel = el.closest('label');
      if (parentLabel && parentLabel.textContent.trim()) return false;
      return true;
    });
    if (unlabelled.length) {
      addIssue({
        id: 'form-label-missing',
        title: 'Form fields without an associated label',
        severity: 'critical',
        wcag: '1.3.1 Info and Relationships / 4.1.2 Name, Role, Value (Level A)',
        description: 'These form fields have no <label>, aria-label, aria-labelledby, or title, so a screen reader user cannot tell what information to enter.',
        fix: 'Add a visible <label for="field-id"> linked to the field, or an aria-label if a visible label isn\'t appropriate.',
        caveat: 'This checks that a label is programmatically associated — it does not check the label text is actually descriptive.',
      }, unlabelled);
    }
  }

  // ---- 3. Links/buttons with no accessible name (WCAG 4.1.2 / 2.4.4) ----
  {
    const controls = Array.from(document.querySelectorAll('a[href], button, [role="button"]')).filter(isVisible);
    const empty = controls.filter((el) => accessibleNameLength(el) === 0);
    if (empty.length) {
      addIssue({
        id: 'control-no-name',
        title: 'Links or buttons with no accessible text',
        severity: 'critical',
        wcag: '2.4.4 Link Purpose / 4.1.2 Name, Role, Value (Level A)',
        description: 'These interactive elements have no text, aria-label, or labelled image inside them, so a screen reader announces them as just "link" or "button" with no purpose.',
        fix: 'Add visible text, or an aria-label describing what the control does (e.g. aria-label="Close menu").',
        caveat: 'Icon-only buttons that DO have an aria-label will correctly not be flagged here.',
      }, empty);
    }
  }

  // ---- 4. Missing document language (WCAG 3.1.1) ----
  {
    const html = document.documentElement;
    if (!html.getAttribute('lang') || !html.getAttribute('lang').trim()) {
      issues.push({
        id: 'html-lang-missing',
        title: 'Page is missing a language attribute',
        severity: 'serious',
        wcag: '3.1.1 Language of Page (Level A)',
        description: 'The <html> element has no lang attribute, so screen readers may use the wrong pronunciation rules or voice for the page.',
        fix: 'Add a lang attribute to <html>, e.g. <html lang="en">.',
        selector: 'html',
        html: '<html>',
        caveat: null,
      });
    }
  }

  // ---- 5. Missing page title (WCAG 2.4.2) ----
  {
    if (!document.title || !document.title.trim()) {
      issues.push({
        id: 'title-missing',
        title: 'Page has no <title>',
        severity: 'serious',
        wcag: '2.4.2 Page Titled (Level A)',
        description: 'There is no page title, so screen reader users and anyone with many tabs open can\'t identify this page.',
        fix: 'Add a unique, descriptive <title> in the <head>.',
        selector: 'head > title',
        html: '<title></title>',
        caveat: null,
      });
    }
  }

  // ---- 6. Heading structure (WCAG 1.3.1) ----
  {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(isVisible);
    const levels = headings.map((h) => parseInt(h.tagName[1], 10));
    const h1s = headings.filter((h) => h.tagName === 'H1');
    const problems = [];
    if (h1s.length === 0 && headings.length > 0) problems.push('no <h1> found');
    if (h1s.length > 1) problems.push(`${h1s.length} <h1> elements found (should usually be one)`);
    let skipped = false;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) skipped = true;
    }
    if (skipped) problems.push('one or more heading levels are skipped (e.g. h2 straight to h4)');
    if (problems.length) {
      issues.push({
        id: 'heading-structure',
        title: 'Heading structure issues',
        severity: 'moderate',
        wcag: '1.3.1 Info and Relationships (Level A)',
        description: `Screen reader users navigate by heading level, and rely on it reflecting the page's real structure. Found: ${problems.join('; ')}.`,
        fix: 'Use exactly one <h1> for the main page title, and don\'t skip heading levels going down the page.',
        selector: 'body',
        html: `${headings.length} headings found`,
        caveat: 'This checks heading levels and count, not whether headings describe their sections well.',
      });
    }
  }

  // ---- 7. Color contrast (WCAG 1.4.3) ----
  {
    function parseColor(str) {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    function relLuminance({ r, g, b }) {
      const chan = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
    }
    function contrastRatio(c1, c2) {
      const l1 = relLuminance(c1);
      const l2 = relLuminance(c2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function effectiveBackground(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = window.getComputedStyle(node).backgroundColor;
        const parsed = parseColor(bg);
        if (parsed && parsed.a > 0) return parsed;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    const textEls = Array.from(document.querySelectorAll('p, span, a, li, td, th, label, button, h1, h2, h3, h4, h5, h6, div'))
      .filter((el) => isVisible(el) && el.textContent && el.textContent.trim().length > 0)
      .filter((el) => {
        // Only count elements whose OWN direct text (not just descendants') is non-empty,
        // to avoid double-flagging the same visible text inside nested wrappers.
        return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      });

    const low = [];
    const sampled = textEls.slice(0, 400); // cap for performance on very large pages
    sampled.forEach((el) => {
      const style = window.getComputedStyle(el);
      const fg = parseColor(style.color);
      if (!fg) return;
      const bg = effectiveBackground(el);
      const ratio = contrastRatio(fg, bg);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = isLarge ? 3 : 4.5;
      if (ratio < threshold) {
        low.push({ el, ratio: ratio.toFixed(2), threshold });
      }
    });
    if (low.length) {
      addIssue({
        id: 'color-contrast',
        title: 'Text with low color contrast against its background',
        severity: 'serious',
        wcag: '1.4.3 Contrast (Minimum) (Level AA)',
        description: `Found ${low.length} text element(s) below the WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large/bold text). Example ratio: ${low[0].ratio}:1 (needs ${low[0].threshold}:1).`,
        fix: 'Darken the text or lighten the background (or vice versa) until the contrast ratio meets the threshold. Use a contrast checker to test the exact hex values.',
        caveat: 'This is calculated from computed CSS colors on a best-effort basis. It can be inaccurate for text over images, gradients, semi-transparent overlays, or CSS-generated content, and does not check hover/focus states.',
      }, low.map((l) => l.el));
    }
  }

  // ---- 8. Duplicate IDs (WCAG 4.1.1) ----
  {
    const ids = {};
    document.querySelectorAll('[id]').forEach((el) => {
      const id = el.id;
      ids[id] = (ids[id] || []).concat(el);
    });
    const dupes = Object.entries(ids).filter(([, els]) => els.length > 1);
    if (dupes.length) {
      issues.push({
        id: 'duplicate-ids',
        title: 'Duplicate id attributes',
        severity: 'moderate',
        wcag: '4.1.1 Parsing (Level A)',
        description: `Found ${dupes.length} id value(s) used more than once (e.g. "${dupes[0][0]}" used ${dupes[0][1].length} times). Duplicate IDs break aria-labelledby/aria-describedby references and label associations.`,
        fix: 'Make every id attribute on the page unique.',
        selector: dupes.map(([id]) => `#${id}`).join(', '),
        html: '',
        caveat: null,
      });
    }
  }

  // ---- 9. iframes without a title (WCAG 4.1.2 / 2.4.1) ----
  {
    const iframes = Array.from(document.querySelectorAll('iframe')).filter(isVisible);
    const untitled = iframes.filter((f) => !f.getAttribute('title') && !f.getAttribute('aria-label'));
    if (untitled.length) {
      addIssue({
        id: 'iframe-title-missing',
        title: 'Embedded frames (iframes) without a title',
        severity: 'moderate',
        wcag: '4.1.2 Name, Role, Value (Level A)',
        description: 'These iframes have no title attribute, so screen reader users have no way to know what content the frame contains before entering it.',
        fix: 'Add a short, descriptive title attribute, e.g. title="YouTube video player".',
      }, untitled);
    }
  }

  // ---- 10. Data tables without header cells (WCAG 1.3.1) ----
  {
    const tables = Array.from(document.querySelectorAll('table')).filter(isVisible);
    const noHeaders = tables.filter((t) => t.querySelectorAll('th').length === 0 && t.rows.length > 1);
    if (noHeaders.length) {
      addIssue({
        id: 'table-no-headers',
        title: 'Tables with no header cells',
        severity: 'moderate',
        wcag: '1.3.1 Info and Relationships (Level A)',
        description: 'These tables have more than one row but no <th> header cells, so screen readers can\'t announce which column or row a cell belongs to.',
        fix: 'Mark header cells with <th scope="col"> or <th scope="row"> as appropriate. If this is a layout table rather than data, consider using CSS layout instead.',
        caveat: 'This flags any multi-row table with zero <th> elements — it cannot tell layout tables from data tables.',
      }, noHeaders);
    }
  }

  // ---- 11. Viewport blocking zoom (WCAG 1.4.4) ----
  {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || '';
      if (/user-scalable\s*=\s*no/i.test(content) || /maximum-scale\s*=\s*1(\.0)?\b/.test(content)) {
        issues.push({
          id: 'viewport-zoom-blocked',
          title: 'Page prevents pinch-zoom / text resizing',
          severity: 'serious',
          wcag: '1.4.4 Resize Text (Level AA)',
          description: `The viewport meta tag (content="${content}") disables zooming, which stops low-vision users from enlarging text on mobile.`,
          fix: 'Remove user-scalable=no and any maximum-scale restriction from the viewport meta tag.',
          selector: 'meta[name="viewport"]',
          html: truncate(viewport.outerHTML, 200),
        });
      }
    }
  }

  // ---- 12. Autoplaying media without controls (WCAG 1.4.2 / 2.2.2) ----
  {
    const media = Array.from(document.querySelectorAll('video[autoplay], audio[autoplay]')).filter(isVisible);
    const problem = media.filter((m) => !m.hasAttribute('muted') && !m.hasAttribute('controls'));
    if (problem.length) {
      addIssue({
        id: 'autoplay-media',
        title: 'Autoplaying audio/video without controls or mute',
        severity: 'moderate',
        wcag: '1.4.2 Audio Control (Level A)',
        description: 'This media plays automatically with sound and gives the user no visible controls to pause or stop it — a serious problem for screen reader users, whose speech output it can drown out.',
        fix: 'Add controls, or mute autoplaying media by default, or don\'t autoplay at all.',
      }, problem);
    }
  }

  // ---- 13. No landmark / main region (informational, WCAG 1.3.1 / 2.4.1) ----
  {
    const main = document.querySelector('main, [role="main"]');
    if (!main) {
      issues.push({
        id: 'no-main-landmark',
        title: 'No <main> landmark found',
        severity: 'minor',
        wcag: '1.3.1 Info and Relationships (Level A) / 2.4.1 Bypass Blocks (Level A)',
        description: 'There\'s no <main> element or role="main" region, which screen reader and keyboard users rely on to jump straight to the primary content, skipping repeated navigation.',
        fix: 'Wrap the primary page content in a <main> element (only one per page).',
        selector: 'body',
        html: '',
      });
    }
  }

  return issues;
}

module.exports = { runChecks };
