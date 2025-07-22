FROM node:20-alpine AS build

WORKDIR /app

RUN apk update && apk add --no-cache dos2unix rsync git

COPY . ./
RUN rm -rf .git
RUN npm install --omit=dev

RUN sed -i 's/\r$//' /app/setup.sh /app/entrypoint.sh
RUN dos2unix /app/setup.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh

RUN sh setup.sh

FROM node:20-alpine

WORKDIR /app

RUN apk update && apk add --no-cache dos2unix rsync git
COPY --from=build /app /app

RUN sed -i 's/\r$//' /app/setup.sh /app/entrypoint.sh
RUN dos2unix /app/setup.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh

RUN [ -f entrypoint.sh ] || (echo "ERROR: entrypoint.sh missing!" && exit 1)
RUN [ -f /app/entrypoint.sh ] || (echo "ERROR: /app/entrypoint.sh missing!" && exit 1)

ENTRYPOINT ["/app/entrypoint.sh"]
