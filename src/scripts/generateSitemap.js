const fs = require('fs');
const path = require('path');

const baseUrl = 'https://careconnectmalawi.com';

const pages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/caregivers', priority: '0.9', changefreq: 'daily' },
  { url: '/specialties', priority: '0.8', changefreq: 'weekly' },
  { url: '/how-it-works', priority: '0.8', changefreq: 'monthly' },
  { url: '/about', priority: '0.7', changefreq: 'monthly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
];

const generateSitemap = () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}
</urlset>`;

  const publicPath = path.join(__dirname, '../../care-connect-enhance/public/sitemap.xml');
  fs.writeFileSync(publicPath, sitemap);
  console.log('✅ Sitemap generated at public/sitemap.xml');
};

generateSitemap();
