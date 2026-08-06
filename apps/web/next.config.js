/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@nutrihub/shared"],
  reactStrictMode: true
};

module.exports = nextConfig;
