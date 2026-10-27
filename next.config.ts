import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A carga inicial envia a planilha por ação do servidor (o padrão é 1 MB); 4,5 MB é o teto da Vercel.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
