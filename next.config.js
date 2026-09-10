/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit (used for the monthly PDF statements) pulls in fontkit, restructure,
  // and iconv-lite, which all use dynamic `require()` calls for font/encoding
  // handling. Webpack tries to statically resolve those at build time and
  // fails even when the packages are installed. Excluding them from bundling
  // lets Node's own module resolution handle them normally at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'fontkit', 'restructure', 'iconv-lite'],
  },
};
module.exports = nextConfig;
