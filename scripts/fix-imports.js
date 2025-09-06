#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * This script fixes the import statements in the compiled JavaScript files
 * to use relative paths instead of package names for internal dependencies.
 */

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace @unified-video/core imports with relative paths
  if (filePath.includes(path.join('packages', 'web', 'dist'))) {
    content = content.replace(
      /require\(["']@unified-video\/core["']\)/g,
      'require("../../core/dist")'
    );
  } else if (filePath.includes(path.join('packages', 'react-native', 'dist'))) {
    content = content.replace(
      /require\(["']@unified-video\/core["']\)/g,
      'require("../../core/dist")'
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.js')) {
      console.log(`Fixing imports in: ${filePath}`);
      fixImports(filePath);
    }
  });
}

// Fix imports in web and react-native packages
const packagesDir = path.join(__dirname, '..', 'packages');

console.log('Fixing import statements in compiled files...');

if (fs.existsSync(path.join(packagesDir, 'web', 'dist'))) {
  processDirectory(path.join(packagesDir, 'web', 'dist'));
}

if (fs.existsSync(path.join(packagesDir, 'react-native', 'dist'))) {
  processDirectory(path.join(packagesDir, 'react-native', 'dist'));
}

console.log('Import fixes complete!');
