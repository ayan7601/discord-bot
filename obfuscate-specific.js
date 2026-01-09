const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const filesToObfuscate = [
    './bot.js',
    './main.js',
    './config.js',
    './mongodb.js',
    './lavalink.js'
];

function obfuscateFile(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath, '.js');
        const dir = path.dirname(filePath);
        const outputPath = path.join(dir, `${fileName}.obfuscated.js`);
        
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            deadCodeInjection: false,
            renameGlobals: false,
            rotateStringArray: true,
            selfDefending: false,
            stringArray: true,
            stringArrayThreshold: 0.75
        }).getObfuscatedCode();
        
        fs.writeFileSync(outputPath, obfuscated);
        console.log(`✅ ${filePath} → ${outputPath}`);
    } catch (error) {
        console.error(`❌ Error: ${filePath} - ${error.message}`);
    }
}

console.log('🔄 Obfuscating specific files...\n');
filesToObfuscate.forEach(obfuscateFile);
console.log('\n✨ Done!');
