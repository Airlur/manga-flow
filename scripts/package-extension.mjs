import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist-extension');

async function copyFilteredDirectory(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyFilteredDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.name.endsWith('.map')) {
      continue;
    }

    await cp(sourcePath, targetPath, { force: true });
  }
}

async function copyFileEnsuringDir(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { force: true });
}

async function getDirectorySize(dir) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
    } else {
      total += (await stat(fullPath)).size;
    }
  }

  return total;
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const manifestRaw = await readFile(path.join(rootDir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw.replace(/^\uFEFF/, ''));

  if (!manifest.background) {
    manifest.background = {};
  }
  manifest.background.type = 'module';

  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  await copyFilteredDirectory(path.join(rootDir, 'dist'), path.join(outputDir, 'dist'));
  await cp(path.join(rootDir, 'icons'), path.join(outputDir, 'icons'), { recursive: true, force: true });
  await cp(path.join(rootDir, 'src', 'assets'), path.join(outputDir, 'src', 'assets'), { recursive: true, force: true });
  await copyFileEnsuringDir(path.join(rootDir, 'src', 'popup', 'popup.html'), path.join(outputDir, 'src', 'popup', 'popup.html'));
  await copyFileEnsuringDir(path.join(rootDir, 'src', 'popup', 'popup.css'), path.join(outputDir, 'src', 'popup', 'popup.css'));
  await copyFileEnsuringDir(path.join(rootDir, 'src', 'styles', 'content.css'), path.join(outputDir, 'src', 'styles', 'content.css'));

  const totalSize = await getDirectorySize(outputDir);
  const totalMb = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`[package-extension] dist-extension 已生成：${outputDir}`);
  console.log(`[package-extension] 体积约 ${totalMb} MB（已排除 source map / node_modules / .git）`);
}

main().catch((error) => {
  console.error('[package-extension] 打包扩展目录失败:', error);
  process.exitCode = 1;
});
