import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() navigation helpers used by the
    // authorization guards in src/lib/auth.
    authInterrupts: true,
    // Raise the server-action request body cap (default 1 MB). Big media is
    // uploaded straight to Storage, but this keeps small action-based uploads
    // (e.g. product photos) from hitting the 1 MB wall. Vercel still caps the
    // platform request body at ~4.5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
