# Website Accessibility Checker

A self-hosted tool that scans any public webpage for common accessibility
issues (WCAG 2.2), shows a plain-English report, and is upfront about what
it *can't* check — pointing people to your Digital Accessibility Specialist
Level 4 apprenticeship page for the parts that need a human.

## What it checks

13 automated checks covering: missing image alt text, unlabelled form
fields, links/buttons with no accessible name, missing page language,
missing page title, heading structure, colour contrast (WCAG AA), duplicate
IDs, untitled iframes, headerless data tables, zoom-blocking viewport tags,
autoplaying media without controls, and missing `<main>` landmark.

Every issue is tagged with its WCAG success criterion, a plain-English
explanation, a suggested fix, and — where relevant — an honest caveat about
what the check can and can't be sure of.

The report also always shows an explicit "What this tool didn't check"
list (keyboard navigation, screen reader behaviour, caption quality, plain
language, PDFs, etc.) so nobody mistakes a clean scan for a full audit.

## Before going live

1. **Edit `public/app.js`** — replace `APPRENTICESHIP_URL` at the top with
   the real link to your Level 4 Digital Accessibility Specialist
   apprenticeship page.
2. **Host it somewhere that runs Node.js.** Fasthosts' standard shared
   hosting only runs PHP/MySQL sites — it can't run this. You have a few
   options, roughly cheapest/easiest first:
   - A Node-friendly host like Render, Railway, or Fly.io (all have free or
     ~$5-10/month tiers, and deploy straight from a GitHub repo).
   - A basic VPS (DigitalOcean, Linode, or Fasthosts' own VPS product if
     they offer one) — more setup, more control.
   - If you want it to *feel* native to your WordPress site rather than a
     separate domain, deploy it on one of the above and then embed it on a
     WordPress page using an `<iframe>`, or point a subdomain
     (e.g. `check.yoursite.com`) at it.
3. Playwright needs its browser binaries — most hosts run `npx playwright
   install --with-deps chromium` automatically on deploy; check your host's
   docs.

## Running it locally

```
npm install express   # only needed if you add Express later — not required as-is
node server/server.js
```

Then open http://localhost:3000

## How it's built

Deliberately dependency-light: a plain Node `http` server plus Playwright
(no Express, no axe-core) so the whole thing is easy to read, audit, and
host anywhere Node runs. `server/checks.js` holds every check with comments
— add or adjust rules there.
