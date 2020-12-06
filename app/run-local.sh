#!/bin/sh
set -xeuo pipefail
cd $(dirname $0)

PORT=8000
docker build . -t app:latest
docker run --env PORT=$PORT -p $PORT:$PORT app:latest
