import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  experimental: {
    reactCompiler: true, // Utiliser React Compiler (React 19)
  },
};

export default config;
