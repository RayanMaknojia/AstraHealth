# AstraHealth production image: one service runs the whole app.
# Stage 1 builds the website with Node; stage 2 runs the Python server, which serves
# that website and the /api endpoints (scan generator + AI proxy) from one address.
#
# Local test:  docker build -t astrahealth . && docker run -p 8080:8080 -e GEMINI_API_KEY=... astrahealth

FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
# The server uses the Python standard library only (no pip installs).
COPY server ./server
COPY --from=web /app/dist ./dist
ENV HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/dist \
    TRUST_PROXY=1 \
    PYTHONUNBUFFERED=1
# Never bake the AI key into the image: set GEMINI_API_KEY on the host.
RUN rm -f server/.env && useradd --create-home astra
USER astra
EXPOSE 8080
CMD ["python", "server/app.py"]
