// 生成不同尺寸的图标
const sharp = require('sharp');
const path = require('path');

const sizes = [16, 32, 48, 128];
const inputPath = path.join(__dirname, 'icons', 'icon128.png');

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = path.join(__dirname, 'icons', `icon${size}.png`);
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon${size}.png`);
  }
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
