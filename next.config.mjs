/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@lancedb/lancedb"],
};

export default nextConfig;
