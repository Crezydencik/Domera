import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* Optimizations for Windows/OneDrive compatibility */
  onDemandEntries: {
    maxInactiveAge: 60000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;

