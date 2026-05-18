const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const umlDir = path.join(__dirname, 'docs', 'uml');
const files = fs.readdirSync(umlDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(umlDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract content between ```mermaid and ```
  const match = content.match(/```mermaid\n([\s\S]*?)```/);
  if (match && match[1]) {
    const mermaidCode = match[1].trim();
    const basename = path.basename(file, '.md');
    
    // Save as .mmd
    const mmdPath = path.join(umlDir, `${basename}.mmd`);
    const pngPath = path.join(umlDir, `${basename}.png`);
    
    fs.writeFileSync(mmdPath, mermaidCode);
    console.log(`Extracted mermaid code for ${file}`);
    
    // Run mermaid-cli
    try {
      const svgPath = path.join(umlDir, `${basename}.svg`);
      console.log(`Rendering ${pngPath} and ${svgPath}...`);
      
      // Generate PNG
      execSync(`npx -y @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${pngPath}" -b transparent -s 2`, { stdio: 'inherit' });
      // Generate SVG
      execSync(`npx -y @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${svgPath}" -b transparent`, { stdio: 'inherit' });
      
      console.log(`✓ Created diagrams for ${basename}`);
    } catch (e) {
      console.error(`✗ Failed to render ${file}:`, e.message);
    }
  }
}

console.log("Done generating diagrams.");
