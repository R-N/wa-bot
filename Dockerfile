FROM node:20-slim AS build

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
  dos2unix rsync git ca-certificates curl libc6 libstdc++6 libgomp1 python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . ./
RUN rm -rf .git
RUN npm install --omit=dev

RUN sed -i 's/\r$//' /app/setup.sh /app/entrypoint.sh
RUN dos2unix /app/setup.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh

RUN sh setup.sh

FROM node:20-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
  dos2unix rsync git ca-certificates curl libc6 libstdc++6 libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

RUN sed -i 's/\r$//' /app/setup.sh /app/entrypoint.sh
RUN dos2unix /app/setup.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh

ENV TRANSFORMERS_CACHE=/app/cache
RUN mkdir -p /app/cache
RUN node -e "import('@xenova/transformers').then(async ({ pipeline }) => { await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2') })"

RUN [ -f entrypoint.sh ] || (echo "ERROR: entrypoint.sh missing!" && exit 1)
RUN [ -f /app/entrypoint.sh ] || (echo "ERROR: /app/entrypoint.sh missing!" && exit 1)

ENTRYPOINT ["/app/entrypoint.sh"]
