# MCMC Nexus CLI Speedtest

An unofficial command-line interface (CLI) tool to perform network speed tests against MCMC Nexus servers.

## 1. Introduction

This tool provides a way to measure ping, download, and upload speeds from your command line. It is designed for developers, network engineers, and power users who need a quick and scriptable way to test their internet performance against the MCMC Nexus app.

## 2. Disclaimer

This is an **UNOFFICIAL** tool and is not affiliated with, endorsed by, or supported by MCMC or Metricell. The results provided are for informational purposes only and may differ from the official MCMC Nexus application due to different testing methodologies and environments. For official results, please use the MCMC Nexus app.

## 3. Why This Tool Exists

The official MCMC Nexus mobile application (Android Version) utilizes Google's Play Integrity verification. This security measure can prevent the app from running on devices that are rooted, have unlocked bootloaders, or are using uncertified custom ROMs. (Have no idea why they do this)

This CLI tool was developed as an alternative for users on such devices. By reverse-engineering the network requests made by the official app, this tool allows for direct speed testing without the need for Play Integrity verification.

## 4. Features and Screenshots

*   Performs Ping, Download, and Upload tests.
*   Configurable number of threads for concurrent testing.
*   Configurable duration for download/upload tests.
*   Clean, color-coded output with progress bars.
*   Builds into a single, standalone executable for Windows, macOS, and Linux.
<img width="793" height="959" alt="Screenshot 2025-07-20 at 17 18 54" src="https://github.com/user-attachments/assets/52f8164f-67e2-49bf-bf58-a102ee4e4bc1" />

## 5. Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/samleong123/mcmc-nexus-cli.git
    cd mcmc-nexus-cli
    ```
2.  Install dependencies:
    ```sh
    npm install
    ```

## 6. Usage

Run the speed test with default settings:
```sh
npm run speedtest
```

### Command-Line Options

You can customize the test with the following options:

*   `-t`, `--threads`: Number of threads for download/upload tests (Default: 8).
*   `-d`, `--duration`: Duration of download/upload tests in seconds (Default: 15).
*   `-p`, `--ping-count`: Number of pings to perform (Default: 4).
*   `-f`, `--file-size`: Size of the file to generate for upload tests in MB (Default: 2).
*   `-h`, `--help`: Show the help message.

**Example:**
```sh
npm run speedtest  -t 16 -d 30
```

## 7. Building Executables

You can package the tool into a standalone executable for your platform.

1.  First, ensure all dependencies are installed (`npm install`).
2.  Run the build script:
    ```sh
    npm run build
    ```
This command uses `esbuild` to bundle the application and then `pkg` to create executables for Linux, macOS, and Windows in the `dist/` directory.

## 8. Credits

This tool relies on the following external services and is inspired by the original application:

*   **IP and ISP Information**: Provided by the free and open-source [ip.sb API](https://ip.sb/).
*   **Original Application**: This CLI is an unofficial alternative to the official [MCMC Nexus App on the Google Play Store](https://play.google.com/store/apps/details?id=gov.mcmc.nexus&hl=en&pli=1).

## 9. Data Collected by the MCMC Nexus App

Based on analysis of the official app's network traffic, a significant amount of data is collected during a test cycle and sent to their servers. A sample of this data can be found in the [`sample_surveyor_collection_mcmc.json`](sample_surveyor_collection_mcmc.json) file in this repository. The data is typically sent to an endpoint like `https://mcmc-my.mycoveragechecker.com/SurveyorCollection/v1/{id}`.

The collected data includes, but is not limited to:

#### Device and Session Information
*   **Device**: Manufacturer, model, and OS version (e.g., Google Pixel 8 Pro on Android 16).
*   **SIM and Operator**: SIM carrier name, MCC, MNC, and roaming status.
*   **Session**: A unique ID for each test session.

#### Network and Connectivity Data
*   **Connection Type**: Whether the device is connected via Wi-Fi or mobile data.
*   **Wi-Fi Details**: BSSID, RSSI (signal strength), link speed, frequency, and a list of other in-range Wi-Fi networks.
*   **Cellular Network**: Serving cell information (CID, TAC, PCI), signal strength (RSRP), quality (RSRQ), and details on neighboring cells.

#### Network Tests
*   **Download Test**: The test URL, file size, duration, average/max transfer rates, and technology used (e.g., 5G NSA).
*   **Upload Test**: Similar metrics to the download test.
*   **Ping Test**: The test URL, average latency, jitter, and minimum ping.

#### Device Status and Sensor Readings
*   **Battery**: Level, charging state, health, and temperature.
*   **Device State**: Screen status (on/off), VPN status, and whether Wi-Fi calling is active.

**Note**: This CLI tool **does not** collect or transmit this level of detailed information. It only performs the network tests.