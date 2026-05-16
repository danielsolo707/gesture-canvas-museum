import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tasksVisionSourceDir = path.join(__dirname, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const tasksVisionTargetDir = path.join(__dirname, '..', 'public', 'tasks-vision', 'wasm');

async function copyFileSet(sourceDir, targetDir, files) {
  await fs.mkdir(targetDir, { recursive: true });

  let copyErrors = 0;
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    try {
      await fs.access(sourcePath);
      await fs.copyFile(sourcePath, targetPath);
      console.log(`Copied ${file}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Warning: ${file} not found in node_modules`);
      } else {
        console.error(`Error copying ${file}: ${err.message}`);
        copyErrors++;
      }
    }
  }

  return copyErrors;
}

async function copyFiles() {
  try {
    let copyErrors = 0;
    copyErrors += await copyFileSet(tasksVisionSourceDir, tasksVisionTargetDir, [
      'vision_wasm_internal.js',
      'vision_wasm_internal.wasm',
      'vision_wasm_module_internal.js',
      'vision_wasm_module_internal.wasm',
      'vision_wasm_nosimd_internal.js',
      'vision_wasm_nosimd_internal.wasm',
    ]);

    if (copyErrors > 0) {
      console.warn(`Completed with ${copyErrors} errors`);
    } else {
      console.log('MediaPipe WASM assets copied successfully');
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

copyFiles();
