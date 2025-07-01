FROM node:20

WORKDIR /app

RUN apt update && apt install -y dos2unix rsync

COPY . ./
RUN rm -rf .git
RUN npm install --omit=dev

RUN sed -i 's/\r$//' /app/setup.sh /app/entrypoint.sh
RUN dos2unix /app/setup.sh /app/entrypoint.sh
RUN chmod +x /app/setup.sh /app/entrypoint.sh

RUN sh setup.sh

WORKDIR /app

ENTRYPOINT ["/app/entrypoint.sh"]
