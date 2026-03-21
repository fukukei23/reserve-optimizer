FROM ghcr.io/openclaw/openclaw:2026.3.12

USER root

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libasound2 \
    libxdamage1 \
    libxcomposite1 \
    libxrandr2 \
    libxi6 \
    libgbm1 \
    xdg-utils \
    ca-certificates \
    jq \
    inotify-tools \
    zip \
    ffmpeg \
    yt-dlp \
    pandoc \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

USER node
