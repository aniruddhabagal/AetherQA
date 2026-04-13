FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx tsc

# Install Playwright browsers inside the image
RUN npx playwright install chromium

# Create directories for generated artifacts
RUN mkdir -p tests/generated tests/specs/feature tests/specs/regression \
    tests/fixtures/audio tests/fixtures/db tests/.auth runs

EXPOSE 4000
CMD ["node", "dist/index.js"]
