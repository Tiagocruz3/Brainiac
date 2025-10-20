#!/usr/bin/env node

/**
 * Vercel Deployment Checker
 * Run this script to verify your environment is ready for Vercel deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Vercel deployment readiness...\n');

let hasErrors = false;
let hasWarnings = false;

// Check 1: Node.js version
console.log('1️⃣  Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 20) {
  console.log('   ✅ Node.js version:', nodeVersion);
} else {
  console.log('   ❌ Node.js version:', nodeVersion, '(Need 20+)');
  hasErrors = true;
}
console.log('');

// Check 2: Package.json exists
console.log('2️⃣  Checking package.json...');
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('   ✅ package.json found');
  
  // Check for @vercel/remix
  if (pkg.devDependencies?.['@vercel/remix']) {
    console.log('   ✅ @vercel/remix installed:', pkg.devDependencies['@vercel/remix']);
  } else {
    console.log('   ⚠️  @vercel/remix not found in devDependencies');
    hasWarnings = true;
  }
  
  // Check build script
  if (pkg.scripts?.build) {
    console.log('   ✅ Build script found:', pkg.scripts.build);
  } else {
    console.log('   ❌ No build script found');
    hasErrors = true;
  }
} else {
  console.log('   ❌ package.json not found');
  hasErrors = true;
}
console.log('');

// Check 3: Vercel.json
console.log('3️⃣  Checking vercel.json...');
if (fs.existsSync('vercel.json')) {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  console.log('   ✅ vercel.json found');
  
  if (vercelConfig.buildCommand) {
    console.log('   ✅ Build command configured:', vercelConfig.buildCommand);
  }
  
  if (vercelConfig.functions) {
    console.log('   ✅ Functions configuration found');
  }
} else {
  console.log('   ⚠️  vercel.json not found (optional but recommended)');
  hasWarnings = true;
}
console.log('');

// Check 4: Environment variables
console.log('4️⃣  Checking environment variables...');
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GROQ_API_KEY',
  'OPEN_ROUTER_API_KEY'
];

let hasAtLeastOneProvider = false;
const envFilePath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envFilePath)) {
  console.log('   ✅ .env.local found (for local development)');
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  
  for (const envVar of requiredEnvVars) {
    if (envContent.includes(`${envVar}=`) && !envContent.includes(`${envVar}=your-`)) {
      hasAtLeastOneProvider = true;
      console.log(`   ✅ ${envVar} appears to be set`);
    }
  }
} else {
  console.log('   ⚠️  .env.local not found (create one for local testing)');
  hasWarnings = true;
}

if (!hasAtLeastOneProvider) {
  console.log('   ⚠️  No LLM provider API keys found in .env.local');
  console.log('   ℹ️  Make sure to set them in Vercel Dashboard!');
  hasWarnings = true;
}
console.log('');

// Check 5: Build output directory
console.log('5️⃣  Checking build output...');
if (fs.existsSync('build')) {
  console.log('   ✅ build directory exists');
  
  if (fs.existsSync('build/client')) {
    console.log('   ✅ build/client directory exists');
  } else {
    console.log('   ⚠️  build/client not found (run pnpm build first)');
    hasWarnings = true;
  }
  
  if (fs.existsSync('build/server')) {
    console.log('   ✅ build/server directory exists');
  } else {
    console.log('   ⚠️  build/server not found (run pnpm build first)');
    hasWarnings = true;
  }
} else {
  console.log('   ⚠️  build directory not found (run pnpm build first)');
  hasWarnings = true;
}
console.log('');

// Check 6: Vite config
console.log('6️⃣  Checking vite.config.ts...');
if (fs.existsSync('vite.config.ts')) {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  console.log('   ✅ vite.config.ts found');
  
  if (viteConfig.includes('vercelPreset')) {
    console.log('   ✅ vercelPreset configured');
  } else {
    console.log('   ❌ vercelPreset not found in vite.config.ts');
    hasErrors = true;
  }
} else {
  console.log('   ❌ vite.config.ts not found');
  hasErrors = true;
}
console.log('');

// Summary
console.log('═══════════════════════════════════════════════════');
console.log('📊 SUMMARY');
console.log('═══════════════════════════════════════════════════');

if (hasErrors) {
  console.log('❌ Deployment readiness: FAILED');
  console.log('   Please fix the errors above before deploying to Vercel.');
} else if (hasWarnings) {
  console.log('⚠️  Deployment readiness: WARNINGS');
  console.log('   You can deploy, but review the warnings above.');
} else {
  console.log('✅ Deployment readiness: READY');
  console.log('   Your project looks good for Vercel deployment!');
}

console.log('\n📝 Next Steps:');
console.log('1. Run: pnpm build (if not done already)');
console.log('2. Set environment variables in Vercel Dashboard');
console.log('3. Deploy: vercel --prod');
console.log('4. Check logs if deployment fails: vercel logs <url>');
console.log('\nFor more info, see: VERCEL_DEPLOYMENT.md\n');

process.exit(hasErrors ? 1 : 0);

