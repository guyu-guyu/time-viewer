import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 允许局域网 IP 作为 dev 来源(修复 Cross origin 警告) */
  allowedDevOrigins: ["192.168.31.18", "100.91.240.70", "localhost"],
};

export default nextConfig;
