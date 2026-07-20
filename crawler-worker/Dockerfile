FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./

USER pwuser
ENV NODE_ENV=production PORT=8080 MAX_CONCURRENT_PAGES=2
EXPOSE 8080
CMD ["npm", "start"]
