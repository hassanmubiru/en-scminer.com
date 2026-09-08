#!/bin/sh
# Start stunnel as TLS proxy, then start the Node.js API

# Parse Neon host from DATABASE_URL to configure stunnel dynamically
if [ -n "$DATABASE_URL" ]; then
  # Extract host from postgresql://user:pass@HOST:PORT/db
  NEON_HOST=$(echo "$DATABASE_URL" | sed 's|.*@||' | sed 's|:.*||' | sed 's|/.*||')
  
  if [ -n "$NEON_HOST" ] && [ "$NEON_HOST" != "localhost" ] && [ "$NEON_HOST" != "127.0.0.1" ]; then
    echo "[start.sh] Starting stunnel for $NEON_HOST -> localhost:5433"
    
    cat > /tmp/stunnel.conf << EOF
foreground = no
pid = /tmp/stunnel.pid

[neon-postgres]
client  = yes
accept  = 127.0.0.1:5433
connect = ${NEON_HOST}:5432
verifyChain = no
EOF
    
    stunnel /tmp/stunnel.conf
    sleep 1
    
    # Rewrite DATABASE_URL to point to local stunnel proxy
    # Replace host:port with localhost:5433, strip sslmode params
    NEON_USER=$(echo "$DATABASE_URL" | sed 's|postgresql://||' | sed 's|:.*||')
    NEON_PASS=$(echo "$DATABASE_URL" | sed 's|.*://[^:]*:||' | sed 's|@.*||')
    NEON_DB=$(echo "$DATABASE_URL" | sed 's|.*/||' | sed 's|?.*||')
    export DATABASE_URL="postgresql://${NEON_USER}:${NEON_PASS}@localhost:5433/${NEON_DB}"
    echo "[start.sh] DATABASE_URL rewritten to use stunnel proxy"
  fi
fi

echo "[start.sh] Starting Node.js API..."
exec node dist/main.js
