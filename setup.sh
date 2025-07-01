#!/bin/sh

echo "$(date +"%Y-%m-%d %H:%M:%S") | Syncing mounted source to /app..."
find /app -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} +
rsync -av --exclude=node_modules /mnt/src/ /app/

cd /app

echo "$(date +"%Y-%m-%d %H:%M:%S") | Installing dependencies..."
npm install --omit=dev
