#!/bin/sh

./setup.sh

cd /app

echo "$(date +"%Y-%m-%d %H:%M:%S") | Starting bot..."
exec npm run start
