FROM ghcr.io/openclaw/openclaw:latest

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    git \
    curl \
    jq \
    python3 \
    python3-pip \
    yt-dlp \
    pandoc \
    imagemagick \
    ghostscript \
    poppler-utils \
    ripgrep \
    unzip \
    wget \
    sqlite3 \
    build-essential \
    openssh-client \
    rsync \
    zip \
    file \
    tree \
    htop \
    net-tools \
    dnsutils \
    iproute2 \
    locales \
    tzdata \
    ca-certificates \
    lsof \
    strace \
    ncdu \
    mediainfo \
    exiftool \
    parallel \
    vim \
    less \
    man-db \
    socat \
    tcpdump \
    nmap \
    postgresql-client \
    redis-tools \
    apache2-utils \
    bat \
    default-mysql-client \
    kcat \
    httpie \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

USER node
