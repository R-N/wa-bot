#!/bin/sh

pwd
ls

cd /app

echo "$(date +"%Y-%m-%d %H:%M:%S") | Installing dependencies..."
rm -rf .git
npm install --omit=dev
