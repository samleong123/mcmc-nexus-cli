import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';
import chalk from 'chalk';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import cliProgress from 'cli-progress';
import os from 'os';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns/promises';

const execPromise = promisify(exec);

// Configuration
const DOWNLOAD_URLS = [
  'https://mcmc-my.metricelltestcloud.com/SpeedTest/100mb.jpg'
];
const hostname = 'mcmc-my.metricelltestcloud.com';
const UPLOAD_URL = 'https://mcmc-my.metricelltestcloud.com/UploadSpeedTest';
const DEFAULT_THREADS = 8;
const DEFAULT_TEST_DURATION = 15; // seconds
const DEFAULT_PING_COUNT = 4; // number of pings
const TEMP_FILE_PATH = `${os.tmpdir()}/speedtest_upload.bin`;
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
];

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('threads', {
    alias: 't',
    type: 'number',
    description: 'Number of threads for download/upload tests',
    default: DEFAULT_THREADS,
    coerce: (arg) => Math.max(1, Math.min(64, arg))
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Duration of download/upload tests in seconds',
    default: DEFAULT_TEST_DURATION
  })
  .option('ping-count', {
    alias: 'p',
    type: 'number',
    description: 'Number of pings to perform',
    default: DEFAULT_PING_COUNT,
    coerce: (arg) => Math.max(1, Math.min(10, arg))
  })
  .option('file-size', {
    alias: 'f',
    type: 'number',
    description: 'Size of generated file for upload tests in MB',
    default: 2
  })
  .help()
  .alias('help', 'h')
  .epilogue('For more information or to report an issue, please visit:\nhttps://github.com/samleong123/mcmc-nexus-cli')
  .argv;

// Get random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}


// Get current IP address with ISP and location information
async function getIPAddress() {
  try {
    // Get detailed IP information including ISP and location
    const response = await axios.get('https://api.ip.sb/geoip');
    const ipInfo = response.data;
    
    // Extract relevant information
    const ip = ipInfo.ip || 'Unknown';
    const isp = ipInfo.organization || ipInfo.isp || 'Unknown ISP';
    const location = [
      ipInfo.city,
      ipInfo.region,
      ipInfo.country
    ].filter(Boolean).join(', ') || 'Unknown location';
    
    return {
      ip,
      isp,
      location
    };
  } catch (error) {
    console.error(chalk.red('Error fetching IP address:'), error.message);
    return {
      ip: 'Unknown',
      isp: 'Unknown',
      location: 'Unknown'
    };
  }
}

// Generate random binary file for upload testing
function generateRandomFile(sizeInMB) {
  const sizeInBytes = sizeInMB * 1024 * 1024;
    if (sizeInBytes <= 0) {
        return Promise.reject(new Error('File size must be greater than 0 MB'));
    }
  
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(TEMP_FILE_PATH);
    let bytesWritten = 0;
    
    const writeChunk = () => {
      const chunkSize = Math.min(1024 * 1024, sizeInBytes - bytesWritten);
      if (chunkSize <= 0) {
        writeStream.end();
        return;
      }
      
      const buffer = crypto.randomBytes(chunkSize);
      const canContinue = writeStream.write(buffer);
      bytesWritten += chunkSize;
      
      if (canContinue && bytesWritten < sizeInBytes) {
        writeChunk();
      } else if (bytesWritten < sizeInBytes) {
        writeStream.once('drain', writeChunk);
      } else {
        writeStream.end();
      }
    };
    
    writeStream.on('finish', () => resolve(TEMP_FILE_PATH));
    writeStream.on('error', reject);
    
    writeChunk();
  });
}

// Ping test using HTTP request instead of system command
async function runPingTest(pingCount) {
  console.log(chalk.cyan('\n=== PING TEST ==='));
  console.log(chalk.gray('------------------------------------------------'));
  
  const pingUrl = 'https://mcmc-my.metricelltestcloud.com/speedtest/latency.txt';
  
  const pingBar = new cliProgress.SingleBar({
    format: `Ping     |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} pings | Latency: {latency} ms`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    stopOnComplete: true,
  });

  pingBar.start(pingCount, 0, { latency: 'N/A' });
  
  const pingResults = [];
  
  for (let i = 0; i < pingCount; i++) {
    try {
      const startTime = performance.now();
      await axios.get(pingUrl, {
        timeout: 5000,
        headers: { 'User-Agent': getRandomUserAgent() }
      });
      const endTime = performance.now();
      const pingTime = endTime - startTime;
      
      pingResults.push(pingTime);
      pingBar.update(i + 1, { latency: pingTime.toFixed(2) });
      
    } catch (error) {
      pingBar.update(i + 1, { latency: 'Failed' });
      // Log the error on a new line so it doesn't mess up the progress bar
      console.error(chalk.red(`\nPing error on attempt ${i + 1}: ${error.message}`));
    }
    
    // Wait 1 second between pings, unless it's the last one
    if (i < pingCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  pingBar.stop();
  
  if (pingResults.length === 0) {
    console.log(chalk.red('\nAll ping attempts failed.'));
    return null;
  }
  
  const minPing = Math.min(...pingResults);
  const maxPing = Math.max(...pingResults);
  const avgPing = pingResults.reduce((sum, time) => sum + time, 0) / pingResults.length;
  
  // Add a newline to separate from the progress bar
  console.log(chalk.green(`\nMin Ping: ${minPing.toFixed(2)} ms`));
  console.log(chalk.green(`Avg Ping: ${avgPing.toFixed(2)} ms`));
  console.log(chalk.green(`Max Ping: ${maxPing.toFixed(2)} ms`));
  
  return avgPing;
}

// Function to perform DNS lookup
async function getServerDetails(hostname) {
  console.log(chalk.yellow(`Connecting to server...`));
  
  try {
    // Perform DNS lookup using Node.js native 'dns' module
    let serverIP = 'Unknown';
    try {
    const addresses = await dns.lookup(hostname, { family: 0 }); 
      serverIP = addresses.address;
    } catch (dnsError) {
      // fallback to 'Unknown' if DNS lookup fails
    }
    
    // Get more details about the server IP
    try {
      const response = await axios.get(`https://api.ip.sb/geoip/${serverIP}`);
      const ipInfo = response.data;
      
      return {
        hostname,
        ip: serverIP,
        isp: ipInfo.organization || ipInfo.isp || 'Unknown',
        location: [
          ipInfo.city,
          ipInfo.region,
          ipInfo.country
        ].filter(Boolean).join(', ') || 'Unknown / Anycast'
      };
    } catch (ipError) {
      // If IP details lookup fails, return basic info
      return {
        hostname,
        ip: serverIP,
        isp: 'Unknown',
        location: 'Unknown'
      };
    }
  } catch (error) {
    console.error(chalk.red(`Error looking up server details: ${error.message}`));
    return {
      hostname,
      ip: 'Unknown',
      isp: 'Unknown',
      location: 'Unknown'
    };
  }
}

// Download speed test - Rewritten for accuracy and proper termination
async function runDownloadTest(threads, duration) {
  console.log(chalk.cyan('\n=== DOWNLOAD TEST ==='));
  console.log(chalk.gray('------------------------------------------------'));

  const downloadUrl = DOWNLOAD_URLS[0];
  const userAgent = getRandomUserAgent();
  let totalBytesDownloaded = 0;
  let isTestRunning = true;

  const downloadBar = new cliProgress.SingleBar({
    format: `Download |${chalk.green('{bar}')}| {percentage}% | {value}/{total}s | {speed} Mbps`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    stopOnComplete: true,
  });

  downloadBar.start(duration, 0, { speed: '0.00' });

  const startTime = performance.now();
  const abortControllers = Array(threads).fill(null).map(() => new AbortController());

  const updateProgressBar = () => {
    const elapsedSeconds = (performance.now() - startTime) / 1000;
    if (elapsedSeconds > duration) {
      isTestRunning = false;
      // Final update to 100%
      const finalSpeed = ((totalBytesDownloaded * 8) / (1024 * 1024) / duration).toFixed(2);
      downloadBar.update(duration, { speed: finalSpeed });
      downloadBar.stop();
      abortControllers.forEach(ac => ac.abort());
      return;
    }
    
    const speedMbps = ((totalBytesDownloaded * 8) / (1024 * 1024) / elapsedSeconds).toFixed(2);
    downloadBar.update(Math.floor(elapsedSeconds), { speed: speedMbps });
    
    setTimeout(updateProgressBar, 200);
  };

  updateProgressBar();

  const downloadPromises = Array(threads).fill(null).map(async (_, index) => {
    while (isTestRunning) {
      let lastLoaded = 0;
      try {
        await axios({
          method: 'get',
          url: downloadUrl,
          responseType: 'arraybuffer',
          headers: { 'User-Agent': userAgent },
          timeout: 10000,
          signal: abortControllers[index].signal,
          onDownloadProgress: (progressEvent) => {
            if (!isTestRunning) {
              abortControllers[index].abort();
              return;
            }
            const delta = progressEvent.loaded - lastLoaded;
            lastLoaded = progressEvent.loaded;
            totalBytesDownloaded += delta;
          },
        });
      } catch (error) {
        if (!isTestRunning) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  });

  await Promise.allSettled(downloadPromises);

  const finalSpeedMbps = ((totalBytesDownloaded * 8) / (1024 * 1024) / duration).toFixed(2);
  
  console.log(chalk.green(`\nDownload Speed: ${finalSpeedMbps} Mbps`));
  console.log(chalk.gray(`Total data downloaded: ${(totalBytesDownloaded / (1024 * 1024)).toFixed(2)} MB`));

  return parseFloat(finalSpeedMbps);
}

// Upload speed test - Rewritten for accuracy and proper termination
async function runUploadTest(threads, duration, fileSize) {
  console.log(chalk.cyan('\n=== UPLOAD TEST ==='));
  console.log(chalk.gray('------------------------------------------------'));

  let filePath;
  try {
    filePath = await generateRandomFile(fileSize);
  } catch (error) {
    console.error(chalk.red(`Error generating test file: ${error.message}`));
    return null;
  }

  const fileData = fs.readFileSync(filePath);
  const userAgent = getRandomUserAgent();
  let totalBytesUploaded = 0;
  let isTestRunning = true;

  const uploadBar = new cliProgress.SingleBar({
    format: `Upload   |${chalk.blue('{bar}')}| {percentage}% | {value}/{total}s | {speed} Mbps`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    stopOnComplete: true,
  });

  uploadBar.start(duration, 0, { speed: '0.00' });

  const startTime = performance.now();
  const abortControllers = Array(threads).fill(null).map(() => new AbortController());

  const updateProgressBar = () => {
    const elapsedSeconds = (performance.now() - startTime) / 1000;
    if (elapsedSeconds > duration) {
      isTestRunning = false;
      const finalSpeed = ((totalBytesUploaded * 8) / (1024 * 1024) / duration).toFixed(2);
      uploadBar.update(duration, { speed: finalSpeed });
      uploadBar.stop();
      abortControllers.forEach(ac => ac.abort());
      return;
    }
    
    const speedMbps = ((totalBytesUploaded * 8) / (1024 * 1024) / elapsedSeconds).toFixed(2);
    uploadBar.update(Math.floor(elapsedSeconds), { speed: speedMbps });
    
    setTimeout(updateProgressBar, 200);
  };

  updateProgressBar();

  const uploadPromises = Array(threads).fill(null).map(async (_, index) => {
    while (isTestRunning) {
      try {
        await axios.post(UPLOAD_URL, fileData, {
          headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/octet-stream',
          },
          timeout: 10000,
          signal: abortControllers[index].signal,
          onUploadProgress: (progressEvent) => {
            if (!isTestRunning) {
              abortControllers[index].abort();
            }
          },
        });
        // If successful, add the file size to the total
        if (isTestRunning) {
          totalBytesUploaded += fileData.length;
        }
      } catch (error) {
        if (!isTestRunning) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  });

  await Promise.allSettled(uploadPromises);

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not delete temporary file: ${error.message}`));
  }

  const finalSpeedMbps = ((totalBytesUploaded * 8) / (1024 * 1024) / duration).toFixed(2);

  console.log(chalk.green(`\nUpload Speed: ${finalSpeedMbps} Mbps`));
  console.log(chalk.gray(`Total data uploaded: ${(totalBytesUploaded / (1024 * 1024)).toFixed(2)} MB`));
  
  return parseFloat(finalSpeedMbps);
}


// Main function
async function main() {
  console.log(chalk.bold.white.bgBlue(' [Unofficial] MCMC Nexus CLI Speedtest by @samleong123'));
  console.log(chalk.gray('================================================'));
  
  // Get IP address info
  const ipInfo = await getIPAddress();
  console.log(chalk.yellow(`Your IP Address:    ${ipInfo.ip}`));
  console.log(chalk.yellow(`ISP:                ${ipInfo.isp}`));
  console.log(chalk.yellow(`Location:           ${ipInfo.location}`));
  console.log(chalk.yellow(`Test Configuration: ${argv.threads} threads, ${argv.duration}s test duration`));
  console.log(chalk.gray('================================================'));
  
  // Get server details
  const serverDetails = await getServerDetails(hostname);
  console.log(chalk.cyan('\nMCMC Nexus Speedtest Server Details:'));
  console.log(chalk.gray('------------------------------------------------'));
  console.log(chalk.yellow(`Hostname:        ${serverDetails.hostname}`));
  console.log(chalk.yellow(`IP:              ${serverDetails.ip}`));
  console.log(chalk.yellow(`ISP:             ${serverDetails.isp}`));
  console.log(chalk.yellow(`Location:        ${serverDetails.location}`));
  console.log(chalk.gray('------------------------------------------------'));
  
  // Run tests
  const pingResult = await runPingTest(argv.pingCount);
  const downloadSpeed = await runDownloadTest(argv.threads, argv.duration);
  const uploadSpeed = await runUploadTest(argv.threads, argv.duration, argv.fileSize);
  
  // Print summary
  console.log(chalk.gray('\n================================================'));
  console.log(chalk.bold.white.bgBlue(' TEST RESULTS SUMMARY '));
  console.log(chalk.gray('================================================'));
  console.log(chalk.yellow(`Timestamp:      ${new Date().toLocaleString()}`));
  console.log(chalk.yellow(`IP Address:     ${ipInfo.ip}`));
  console.log(chalk.yellow(`ISP:            ${ipInfo.isp}`));
  console.log(chalk.yellow(`Location:       ${ipInfo.location}`));
  console.log(chalk.yellow(`Thread Count:   ${argv.threads}`));
  console.log(chalk.yellow(`Test Duration:  ${argv.duration} seconds`));
  console.log(chalk.cyan(`Ping:           ${pingResult ? pingResult.toFixed(2) + ' ms' : 'Failed'}`));
  console.log(chalk.green(`Download Speed: ${downloadSpeed ? downloadSpeed + ' Mbps' : 'Failed'}`));
  console.log(chalk.blue(`Upload Speed:   ${uploadSpeed ? uploadSpeed + ' Mbps' : 'Failed'}`));
  console.log(chalk.gray('================================================'));

  // Disclaimer
  console.log(chalk.red('\n================================================'));
  console.log(chalk.red('Disclaimer: This is an unofficial speed test tool for MCMC Nexus.'));
  console.log(chalk.red('Results may vary based on network conditions and server load.'));
  console.log(chalk.red('For official speed tests, please use the MCMC Nexus app.'));
  console.log(chalk.red('================================================'));


}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Error running speed test:'), error);
  process.exit(1);
});