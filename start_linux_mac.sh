#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/backend"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -r requirements.txt
if [ ! -f .local_secret ]; then
  .venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))' > .local_secret
  chmod 600 .local_secret
fi
JWT_SECRET="$(cat .local_secret)"; export JWT_SECRET
echo 'Open http://localhost:8000'
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
