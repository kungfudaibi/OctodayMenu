#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/results/api_test_outputs"
mkdir -p "$OUT_DIR"

PORT_ENV="${PORT:-4444}"
BASE_HOST="http://localhost:${PORT_ENV}"
API_BASE="$BASE_HOST/api"

TIMESTAMP=$(date +%s)
TEST_EMAIL="test+${TIMESTAMP}@example.com"
TEST_PASSWORD="Password123!"
TEST_NICKNAME="testuser${TIMESTAMP}"

echo "Testing API against $BASE_HOST"

# Helper: do curl and save
do_curl() {
  local method=$1
  local url=$2
  local data=$3
  local out=$4
  if [ "$method" = "GET" ]; then
    curl -sS -D - "$url" -o "$out" || true
  else
    curl -sS -D - -X "$method" "$url" -H "Content-Type: application/json" -d "$data" -o "$out" || true
  fi
}

# Wait for health
echo "Waiting for /health to be available..."
for i in {1..12}; do
  resp=$(curl -sS --max-time 2 "$BASE_HOST/health" || true)
  if echo "$resp" | grep -q 'OK'; then
    echo "Health OK"
    echo "$resp" > "$OUT_DIR/health.json"
    break
  fi
  echo "Retrying health ($i)..."
  sleep 1
done

# Register user
register_payload=$(cat <<EOF
{"email":"$TEST_EMAIL","password":"$TEST_PASSWORD","nickname":"$TEST_NICKNAME"}
EOF
)

echo "Registering test user: $TEST_EMAIL"
do_curl "POST" "$API_BASE/auth/register/email" "$register_payload" "$OUT_DIR/register.json"

# Login
login_payload=$(cat <<EOF
{"email":"$TEST_EMAIL","password":"$TEST_PASSWORD"}
EOF
)

echo "Logging in test user"
do_curl "POST" "$API_BASE/auth/login/email" "$login_payload" "$OUT_DIR/login.json"

# Extract token (if present)
TOKEN=""
if command -v python3 >/dev/null 2>&1; then
  TOKEN=$(python3 - <<PYCODE
import sys, json
try:
    j=json.load(open('$OUT_DIR/login.json'))
    print(j.get('data',{}).get('token',''))
except Exception:
    print('')
PYCODE
)
fi

if [ -z "$TOKEN" ]; then
  echo "Warning: no token obtained from login; some endpoints will be accessed without auth"
else
  echo "Token obtained"
fi

AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="-H 'Authorization: Bearer $TOKEN'"
fi

# Convenience function for auth GET using curl directly (to capture headers too)
curl_get() {
  local url=$1
  local out=$2
  if [ -n "$TOKEN" ]; then
    curl -sS -D - "$url" -H "Authorization: Bearer $TOKEN" -o "$out" || true
  else
    curl -sS -D - "$url" -o "$out" || true
  fi
}

# Public endpoints
echo "Fetching restaurants list"
curl_get "$API_BASE/restaurants?page=1&limit=5" "$OUT_DIR/restaurants_list.json"

echo "Fetching a sample restaurant detail (id=1)"
curl_get "$API_BASE/restaurants/1" "$OUT_DIR/restaurant_1.json"

echo "Fetching a sample dish detail (id=1)"
curl_get "$API_BASE/dishes/1" "$OUT_DIR/dish_1.json"

# Recommendations
echo "Fetching random recommendations"
curl_get "$API_BASE/recommendations/random?limit=5" "$OUT_DIR/recommendations_random.json"

echo "Fetching flavor-based recommendations"
curl_get "$API_BASE/recommendations/flavor-based?limit=5&spicy=3" "$OUT_DIR/recommendations_flavor.json"

# User-protected endpoints
echo "Fetching user history"
curl_get "$API_BASE/user/history?page=1&limit=10" "$OUT_DIR/user_history.json"

echo "Fetching user favorites"
curl_get "$API_BASE/user/favorites?page=1&limit=10" "$OUT_DIR/user_favorites.json"

# Try upload endpoint without file (expect validation error)
echo "Calling upload endpoint without file to see error"
(do_curl "POST" "$API_BASE/upload/menu" '{}' "$OUT_DIR/upload_no_file.json")

# Aggregate a simple summary file
python3 - <<PYCODE
import json,glob
out={}
for f in glob.glob('$OUT_DIR/*.json'):
    name=f.split('/')[-1]
    try:
        out[name]=json.load(open(f))
    except Exception as e:
        out[name]={'_raw': open(f).read()}
open('$OUT_DIR/summary.json','w').write(json.dumps(out,ensure_ascii=False,indent=2))
print('Saved summary to $OUT_DIR/summary.json')
PYCODE

echo "API test completed. Outputs saved in $OUT_DIR"
