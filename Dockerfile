FROM node:22-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY basket_yedek.js ./
COPY db ./db
COPY migrations ./migrations
COPY repositories ./repositories
COPY services ./services
COPY maps ./maps

CMD ["node", "basket_yedek.js"]
