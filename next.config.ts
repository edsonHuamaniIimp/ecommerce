import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

type RemotePattern = { protocol: "http" | "https"; hostname: string; port?: string; pathname: string };

/**
 * Hosts permitidos para las imagenes subidas por usuarios:
 * - S3 gestionado por AWS (bucket.s3.<region>.amazonaws.com).
 * - Endpoint S3 compatible (MinIO/otro) declarado en S3_ENDPOINT.
 */
function patronesAlmacenamiento(): RemotePattern[] {
  const patrones: RemotePattern[] = [
    { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
  ];
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      if (url.protocol === "http:" || url.protocol === "https:") {
        patrones.push({
          protocol: url.protocol === "http:" ? "http" : "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
          pathname: "/**",
        });
      }
    } catch {
      // S3_ENDPOINT invalido: se ignora y se mantiene el patron de AWS.
    }
  }
  return patrones;
}

const nextConfig: NextConfig = {
  // Empaquetado standalone para ECS Fargate (frontend + API en un solo contenedor).
  // Es aditivo: genera .next/standalone sin afectar el flujo actual (next start / EC2).
  output: "standalone",
  turbopack: {
    root: path.resolve(projectRoot),
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      tailwindcss: path.resolve(projectRoot, "node_modules/tailwindcss"),
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com", pathname: "/api/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "i.pravatar.cc", pathname: "/**" },
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/**" },
      { protocol: "https", hostname: "secure2.iimp.org", port: "8443", pathname: "/QRGeneratorApp/**" },
      // Imagenes subidas por usuarios (S3 / endpoint compatible).
      ...patronesAlmacenamiento(),
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_DOMAIN || "http://localhost:8000"}${process.env.NEXT_PUBLIC_API_BASE_PATH || ""}/:path*`,
      },
    ];
  },
};

export default nextConfig;
