import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin('./i8n/request.ts');



const nextConfig: NextConfig = {
  /* Optimizations for Windows/OneDrive compatibility */
  onDemandEntries: {
    maxInactiveAge: 60000,
    pagesBufferLength: 5,
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': require('path').resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);

