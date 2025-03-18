const fs = require('fs');
const path = require('path');
const { zip } = require('zip-a-folder');
const fse = require('fs-extra');

const versionFilePath = path.join('./src', 'version.json');

// Function to read version.json and return its data
async function getVersionInfo() {
    try {
        const data = fs.readFileSync(versionFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading version file:', error);
        process.exit(1);
    }
}

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

async function zipFolders(buildNumber, formattedVersion) {
    const wwwFolder = path.join("./", 'www');
    const sourcemapFolder = path.join("./", 'www-sourcemap');
    // Dynamically create zip file names based on the version info
    const wwwZipPath = path.join("./", `bundle_${buildNumber}_${formattedVersion}.zip`);
    const sourcemapZipPath = path.join("./", `bundle_sourcemap_${buildNumber}_${formattedVersion}.zip`);


    // Zip the www folder
    try {
        await zip(wwwFolder, wwwZipPath);
        console.log(`Zipped www folder to ${wwwZipPath}`);
    } catch (error) {
        console.error('Error zipping www folder:', error);
    }

    // Zip the www-sourcemap folder
    try {
        await zip(sourcemapFolder, sourcemapZipPath);
        console.log(`Zipped www-sourcemap folder to ${sourcemapZipPath}`);
    } catch (error) {
        console.error('Error zipping www-sourcemap folder:', error);
    }
}

// Execute the functions in sequence
async function main() {
    try {
        const versionInfo = await getVersionInfo();
        const { buildNumber, formattedVersion } = versionInfo;

        await moveSourceMaps();
        await zipFolders(buildNumber, formattedVersion);
    } catch (error) {
        console.error('Error during operation:', error);
    }
}

main();