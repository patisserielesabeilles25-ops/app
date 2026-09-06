import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() navigation helpers used by the
    // authorization guards in src/lib/auth.
    authInterrupts: true,
  },
};

export default nextConfig;
