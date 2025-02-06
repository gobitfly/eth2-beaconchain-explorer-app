const puppeteer = require('puppeteer');
const { exec } = require('child_process');

(async () => {
  // Function to run docker-compose up
  const runDockerCompose = () => {
    return new Promise((resolve, reject) => {
      exec('docker compose up -d', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running docker-compose: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.warn(`Docker-compose warnings: ${stderr}`);
        }
        console.log(`Docker-compose output: ${stdout}`);
        resolve();
      });
    });
  };

  try {
    console.log('Starting Docker Compose...');
    await runDockerCompose(); // Run docker compose up -d nginx-proxy
    console.log('Docker Compose started successfully.');

    const browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      devtools: true, // Open browser with DevTools enabled
      args: [
        '--disable-web-security', // Disable web security to bypass CORS
        '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,IsolateOrigins,site-per-process', // Additional security disablement
        '--disable-strict-mixed-content-checking', // Allow mixed content
        '--no-sandbox', // Disable sandbox (if needed for Linux)
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors', // Ignore SSL certificate errors (for self-signed certs)
        '--user-data-dir=./tmp',
        '--disable-third-party-cookie-blocking'
        //	'--proxy-server=http://localhost:8088'
      ]
    });

    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    page.on('request', request => {
      const headers = request.headers();

      // Check for any *.beaconcha.in domain
      const url = request.url();
      if (url.endsWith('.beaconcha.in') || url.includes('.beaconcha.in/')) {
        let cookieHeader = headers['cookie'] || '';
        let xCookieHeader = headers['x-cookie'] || '';

        // Parse cookies into key-value pairs
        const parseCookies = (cookieString) => {
          return cookieString.split(';').reduce((acc, pair) => {
            const [key, value] = pair.split('=').map(item => item.trim());
            if (key && value) acc[key] = value;
            return acc;
          }, {});
        };

        const cookieObject = parseCookies(cookieHeader);
        const xCookieObject = parseCookies(xCookieHeader);

        // Merge X-Cookie values, overriding existing Cookie values
        const mergedCookies = { ...cookieObject, ...xCookieObject };

        // Convert merged cookies back to a header string
        const mergedCookieHeader = Object.entries(mergedCookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');

        // Set the new Cookie header
        headers['cookie'] = mergedCookieHeader;

        // Remove the X-Cookie header
        delete headers['x-cookie'];
      }

      // Allow the request to proceed with modified headers
      request.continue({ headers });
    });

    // Emulate a mobile device
    //    const iPhone = puppeteer.devices['iPhone 15 Pro'];
    //    await page.emulate(iPhone);

    // Open your local app
    await page.goto('https://localhost:8103/tabs/dashboard', {
      waitUntil: 'networkidle0'
    });

    console.log('Page loaded with mobile emulation and DevTools enabled.');

    // Optional: Log responses for debugging
    page.on('response', async (response) => {
      const cookies = response.headers()['set-cookie'];

      if (cookies) {
        // Ensure cookies is an array (split if it's a string)
        const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

        cookieArray.forEach(cookie => {
          console.log('Found cookie:', cookie);

          // Extract the cookie value (before the ';' separator)
          const cookieParts = cookie.split(';')[0].split('=');
          const cookieName = cookieParts[0];
          const cookieValue = cookieParts[1];

          const domain = response.url().split('/')[2]; // Extract the domain from the response URL

          // Set the cookie for that domain
          page.setCookie({
            name: cookieName,
            value: cookieValue,
            domain: domain,  // Set cookie for the specific domain
            path: '/',
            secure: true,
            httpOnly: cookie.includes('HttpOnly'),
            sameSite: cookie.includes('SameSite=None') ? 'None' : 'Strict', // Use None if specified, otherwise Strict
          });

          console.log(`Set cookie: ${cookieName} for domain: ${domain}`);
        });
      }
    });

    // Keep the browser open for testing or close it after your actions
    // await browser.close();
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
