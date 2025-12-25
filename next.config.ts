import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // Enable static exports
  basePath: process.env.NODE_ENV === 'production' ? '/sentence_trees' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/sentence_trees/' : '',

	images: {
    unoptimized: true,
  },
  webpack: (config: any) => {
    if (process.env.NODE_ENV === 'production') {
      config.output.publicPath = '/sentence_trees/_next/';
    }
    return config;
  },
  trailingSlash: true ,
}

export default nextConfig;
