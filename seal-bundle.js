const fs = require('fs');
const path = require('path');
const { zip } = require('zip-a-folder');
const fse = require('fs-extra'); 

async function moveSourceMaps() {
    const wwwFolder = path.join("./", 'www');
    const sourcemapFolder = path.join("./", 'www-sourcemap');

    // Ensure the www-sourcemap folder exists
    if (!fs.existsSync(sourcemapFolder)) {
        fs.mkdirSync(sourcemapFolder);
    }

    // Read the contents of the www folder
    const files = fs.readdirSync(wwwFolder);

    // Move all .map files from www to www-sourcemap
    files.forEach(file => {
        if (file.endsWith('.map')) {
            const oldPath = path.join(wwwFolder, file);
            const newPath = path.join(sourcemapFolder, file);

            fse.moveSync(oldPath, newPath, { overwrite: true });
            console.log(`Moved Sourcemap: ${file} to ${newPath}`);
        }
    });
}

async function zipFolders() {
    const wwwFolder = path.join("./", 'www');
    const sourcemapFolder = path.join("./", 'www-sourcemap');
    const wwwZipPath = path.join("./", 'bundle.zip');
    const sourcemapZipPath = path.join("./", 'bundle-sourcemap.zip');

    // Zip the www folder
    try {
        await zip(wwwFolder, wwwZipPath);
        console.log('Zipped www folder to bundle.zip');
    } catch (error) {
        console.error('Error zipping www folder:', error);
    }

    // Zip the www-sourcemap folder
    try {
        await zip(sourcemapFolder, sourcemapZipPath);
        console.log('Zipped www-sourcemap folder to bundle-sourcemap.zip');
    } catch (error) {
        console.error('Error zipping www-sourcemap folder:', error);
    }
}

// Execute the functions in sequence
async function main() {
    try {
        await moveSourceMaps();
        await zipFolders();
    } catch (error) {
        console.error('Error during operation:', error);
    }
}

main();