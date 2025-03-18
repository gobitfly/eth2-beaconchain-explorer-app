const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, './server.crt');
const keyPath = path.join(__dirname, './server.key');

// Ensure the directory exists
const localEnvDir = path.join(__dirname, 'local_env');
if (!fs.existsSync(localEnvDir)) {
    fs.mkdirSync(localEnvDir, { recursive: true });
}

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed certificate and key...');

    try {
        const opensslCommand = `
openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 3650 -subj "/CN=localhost"
        `;
        execSync(opensslCommand, { stdio: 'inherit' });

        console.log('Certificate and key generated successfully.');
    } catch (error) {
        console.error('Error generating certificate and key:', error);
        process.exit(1);
    }
} else {
    console.log('Certificate and key already exist.');
}
