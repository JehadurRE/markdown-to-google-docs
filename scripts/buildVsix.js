const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

console.log(`Building VSIX package for ${pkg.name} v${pkg.version}...`);

// 1. Ensure project is compiled
console.log('Compiling TypeScript...');
execSync('npm run compile', { cwd: root, stdio: 'inherit' });

// 2. Create temporary staging directory
const stageDir = path.join(root, '.vsix-stage');
if (fs.existsSync(stageDir)) {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
fs.mkdirSync(stageDir, { recursive: true });

const extDir = path.join(stageDir, 'extension');
fs.mkdirSync(extDir, { recursive: true });

// 3. Generate [Content_Types].xml
const contentTypesXml = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="xml" ContentType="text/xml"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="html" ContentType="text/html"/>
  <Default Extension="png" ContentType="image/png"/>
</Types>`;
fs.writeFileSync(path.join(stageDir, '[Content_Types].xml'), contentTypesXml, 'utf8');

// 4. Generate extension.vsixmanifest
const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}"/>
    <DisplayName>${pkg.displayName.replace(/&/g, '&amp;')}</DisplayName>
    <Description xml:space="preserve">${pkg.description.replace(/&/g, '&amp;')}</Description>
    <Tags>${(pkg.keywords || []).join(',')}</Tags>
    <Categories>${(pkg.categories || []).join(',')}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace,web" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
    </Properties>
    <License>extension/LICENSE</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
  </Assets>
</PackageManifest>`;
fs.writeFileSync(path.join(stageDir, 'extension.vsixmanifest'), vsixManifest, 'utf8');

// 5. Copy extension runtime files
const filesToCopy = ['package.json', 'README.md', 'LICENSE', 'out'];
for (const f of filesToCopy) {
  const src = path.join(root, f);
  const dest = path.join(extDir, f);
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy production node_modules into extension/node_modules
const prodDeps = Object.keys(pkg.dependencies || {});
const targetNodeModules = path.join(extDir, 'node_modules');
fs.mkdirSync(targetNodeModules, { recursive: true });

console.log('Copying production dependencies to package...');
execSync('npm pack --pack-destination .vsix-stage', { cwd: root, stdio: 'ignore' });
// Copy node_modules (only production packages)
const srcNodeModules = path.join(root, 'node_modules');
if (fs.existsSync(srcNodeModules)) {
  fs.cpSync(srcNodeModules, targetNodeModules, {
    recursive: true,
    filter: (source) => {
      // Exclude devDependencies like @types, typescript
      if (source.includes('@types') || source.includes('typescript') || source.includes('.bin')) {
        return false;
      }
      return true;
    }
  });
}

const zipName = `${pkg.name}-${pkg.version}.zip`;
const zipPath = path.join(root, zipName);
const vsixName = `${pkg.name}-${pkg.version}.vsix`;
const vsixPath = path.join(root, vsixName);

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
if (fs.existsSync(vsixPath)) fs.unlinkSync(vsixPath);

console.log(`Archiving into ${vsixName}...`);
const psZip = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stageDir.replace(/\\/g, '\\\\')}', '${vsixPath.replace(/\\/g, '\\\\')}')"`;
execSync(psZip, { stdio: 'inherit' });

// Cleanup stageDir
fs.rmSync(stageDir, { recursive: true, force: true });

const stats = fs.statSync(vsixPath);
console.log(`\n🎉 Successfully packaged extension: ${vsixName} (${(stats.size / 1024).toFixed(1)} KB)`);
console.log(`Path: ${vsixPath}\n`);
