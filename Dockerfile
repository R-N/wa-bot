FROM node:20

WORKDIR /app

RUN apt update && apt install -y rsync

# Copy setup script
# Install dependencies initially to leverage Docker layer cache
COPY . ./
RUN chmod +x /app/setup.sh
CMD ["/app/setup.sh"]

# Copy entrypoint script
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
