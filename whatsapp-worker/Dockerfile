# Always-on WhatsApp worker for the Nahla Cake Panel.
# The WhatsApp session is stored in Supabase Storage, so no volume is needed.
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App code.
COPY index.mjs authState.mjs ./

ENV NODE_ENV=production

# SUPABASE_URL and SUPABASE_SERVICE_KEY must be provided at runtime
# (docker run -e ..., or the host's env/secret settings).
CMD ["node", "index.mjs"]
