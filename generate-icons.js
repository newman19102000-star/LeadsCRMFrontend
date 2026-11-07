import sharp from 'sharp';
import fs from 'fs';

const sizes = [64, 192, 512];
const svgBuffer = fs.readFileSync('./public/icon.svg');

async function generateIcons() {
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(`./public/pwa-${size}x${size}.png`);
    console.log(`✓ Generated pwa-${size}x${size}.png`);
  }
  
  // Generate maskable icon (same as 512 for now)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/maskable-icon-512x512.png');
  console.log('✓ Generated maskable-icon-512x512.png');
  
  // Generate favicon
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile('./public/favicon.ico');
  console.log('✓ Generated favicon.ico');
  
  // Generate apple-touch-icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('./public/apple-touch-icon.png');
  console.log('✓ Generated apple-touch-icon.png');
  
  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);
