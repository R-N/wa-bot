FROM node:20

WORKDIR /app

RUN apt update && apt install -y rsync

# Copy setup script
# Install dependencies initially to leverage Docker layer cache
COPY . ./
RUN rm -rf .git
RUN npm install --omit=dev
RUN chmod +x /app/setup.sh
RUN sh setup.sh

WORKDIR /app

# Copy entrypoint script
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
