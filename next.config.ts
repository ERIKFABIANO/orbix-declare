import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A proposta do hackathon é uma página estática em public/proposal. O endereço curto
  // /proposal leva ao arquivo: os caminhos relativos dela (./assets, ./vendor) dependem disso.
  async redirects() {
    return [{ source: "/proposal", destination: "/proposal/index.html", permanent: false }];
  },
};

export default nextConfig;
