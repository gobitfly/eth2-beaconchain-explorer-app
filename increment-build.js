const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Path to the version.json file
const filePath = path.join("./src/", 'version.json');

// Create an interface to read input from the user
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Read and parse the version file
fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading version file:', err);
        process.exit(1);
    }

    const versionInfo = JSON.parse(data);

    // Increment the build number
    versionInfo.buildNumber += 1;

    // Ask the user for the formatted version
    rl.question('What is the new version called (semantic versioning): ', (formattedVersionInput) => {
        versionInfo.formattedVersion = formattedVersionInput;

        // Write the updated version info back to the file
        fs.writeFile(filePath, JSON.stringify(versionInfo, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing version file:', err);
                process.exit(1);
            }

            console.log(`Build number updated to: ${versionInfo.buildNumber}`);
            console.log(`Formatted version updated to: ${versionInfo.formattedVersion}`);

            // Close the input stream
            rl.close();
        });

        // // Create a git tag using the formatted version
        // const gitTagCommand = `git tag -a ${versionInfo.formattedVersion} -m "Version ${versionInfo.formattedVersion}"`;

        // exec(gitTagCommand, (error, stdout, stderr) => {
        //     if (error) {
        //         console.error(`Error creating git tag: ${error.message}`);
        //         process.exit(1);
        //     }
        //     if (stderr) {
        //         console.error(`Git error: ${stderr}`);
        //     }

        //     console.log(`Git tag ${versionInfo.formattedVersion} created successfully.`);

        //     // Close the readline interface
        //     rl.close();
        // });
    });
});
