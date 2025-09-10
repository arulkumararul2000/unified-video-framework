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
    // Fix CommonJS require statements
    content = content.replace(
      /require\(["']@unified-video\/core["']\)/g,
      'require("../../core/dist")'
    );
    // Fix ES module import statements
    content = content.replace(
      /from\s+["']@unified-video\/core["']/g,
      'from "../../core/dist/index.js"'
    );
    content = content.replace(
      /import\s+["']@unified-video\/core["']/g,
      'import "../../core/dist/index.js"'
    );
    
    // Fix relative imports within the same package to include .js extension
    content = content.replace(
      /from\s+["']\.\/([^"']+)(?<!\.js)["']/g,
      'from "./$1.js"'
    );
    content = content.replace(
      /from\s+["']\.\.?\/([^"']+)(?<!\.js)["']/g,
      (match, p1) => {
        if (p1.includes('/')) {
          return `from "../${p1.replace(/([^\/]+)$/, '$1.js')}"`;
        }
        return `from "../${p1}.js"`;
      }
    );
  } else if (filePath.includes(path.join('packages', 'react-native', 'dist'))) {
    // Fix CommonJS require statements
    content = content.replace(
      /require\(["']@unified-video\/core["']\)/g,
      'require("../../core/dist")'
    );
    // Fix ES module import statements
    content = content.replace(
      /from\s+["']@unified-video\/core["']/g,
      'from "../../core/dist/index.js"'
    );
    content = content.replace(
      /import\s+["']@unified-video\/core["']/g,
      'import "../../core/dist/index.js"'
    );
    
    // Fix relative imports within the same package to include .js extension
    content = content.replace(
      /from\s+["']\.\/([^"']+)(?<!\.js)["']/g,
      'from "./$1.js"'
    );
    content = content.replace(
      /from\s+["']\.\.?\/([^"']+)(?<!\.js)["']/g,
      (match, p1) => {
        if (p1.includes('/')) {
          return `from "../${p1.replace(/([^\/]+)$/, '$1.js')}"`;
        }
        return `from "../${p1}.js"`;
      }
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
