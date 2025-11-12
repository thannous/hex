import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  experimental: {
    typedRoutes: true,
    reactCompiler: true, // Utiliser React Compiler (React 19)
  },
};

export default config;
