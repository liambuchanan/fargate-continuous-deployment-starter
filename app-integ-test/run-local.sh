#!/bin/sh
set -xeuo pipefail
cd $(dirname $0)

npm install
HOST="http://localhost:8000" npm run test
