#!/usr/bin/env node

/**
 * Script to generate favicon and app icons from a source image
 * 
 * Usage: node scripts/generate-icons.js <path-to-source-image>
 * 
 * Requirements: sharp package (npm install sharp --save-dev)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is required. Install it with: npm install sharp --save-dev');
  console.error('Error details:', e.message);
  process.exit(1);
}

const sourceImagePath = process.argv[2];

if (!sourceImagePath) {
  console.error('Usage: node scripts/generate-icons.js <path-to-source-image>');
  process.exit(1);
}

if (!fs.existsSync(sourceImagePath)) {
  console.error(`Error: Source image not found at ${sourceImagePath}`);
  process.exit(1);
}

const publicDir = path.join(__dirname, '..', 'public');
const appDir = path.join(__dirname, '..', 'app');

// Ensure directories exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Icon sizes to generate
const iconSizes = [
  { size: 16, name: 'icon-16x16.png', dir: 'public' },
  { size: 32, name: 'icon-32x32.png', dir: 'public' },
  { size: 192, name: 'icon-192x192.png', dir: 'public' },
  { size: 512, name: 'icon-512x512.png', dir: 'public' },
  { size: 180, name: 'apple-icon-180x180.png', dir: 'public' },
  { size: 32, name: 'favicon.ico', dir: 'app', format: 'ico' },
];

async function generateIcons() {
  console.log(`Generating icons from ${sourceImagePath}...\n`);

  for (const icon of iconSizes) {
    const outputDir = icon.dir === 'public' ? publicDir : appDir;
    const outputPath = path.join(outputDir, icon.name);
    
    try {
      if (icon.format === 'ico') {
        // For ICO, we'll create a PNG first, then convert (sharp doesn't support ICO directly)
        // For now, just create a 32x32 PNG as favicon.ico (browsers accept PNG in .ico files)
        await sharp(sourceImagePath)
          .resize(icon.size, icon.size, {
            fit: 'contain',
            background: { r: 250, g: 249, b: 246, alpha: 1 } // off-white background
          })
          .png()
          .toFile(outputPath);
      } else {
        await sharp(sourceImagePath)
          .resize(icon.size, icon.size, {
            fit: 'contain',
            background: { r: 250, g: 249, b: 246, alpha: 1 } // off-white background
          })
          .png()
          .toFile(outputPath);
      }
      
      console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${icon.name}:`, error.message);
    }
  }

  console.log('\n✓ All icons generated successfully!');
  console.log('\nIcons are ready in:');
  console.log(`  - public/ (web icons)`);
  console.log(`  - app/ (favicon.ico)`);
}

generateIcons().catch(console.error);
