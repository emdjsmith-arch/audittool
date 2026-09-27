# Microsoft's official Playwright image already has Chromium and every
# system library it needs installed — this avoids the apt-get/root
# problem that PaaS build environments (Render, Railway, etc.) run into
# when Playwright's own installer tries to add OS packages at build time.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
