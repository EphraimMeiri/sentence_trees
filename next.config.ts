import type { NextConfig } from "next";

const nextConfig = {
  output: 'export',  // Enable static exports
  basePath: '/sentence_trees',  // Add this for GitHub Pages
	images: {
    unoptimized: true,
  },
  assetPrefix: '/sentence_trees/',	
  trailingSlash: true ,
}

export default nextConfig;
