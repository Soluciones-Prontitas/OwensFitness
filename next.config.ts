import type { NextConfig } from 'next';
const basePath = '/OwensFitness';
const nextConfig: NextConfig = { basePath, trailingSlash: true, output: 'standalone', env: { NEXT_PUBLIC_BASE_PATH: basePath } };
export default nextConfig;
