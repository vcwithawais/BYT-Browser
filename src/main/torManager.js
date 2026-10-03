// ===== TorManager =====
// Manages the Tor daemon lifecycle: startup, status monitoring, and graceful shutdown.
// The Tor binary is expected to be bundled with the app (or available on the system PATH).

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const TOR_SOCKS_PORT = 9050;
const TOR_CONTROL_PORT = 9051;
const STARTUP_TIMEOUT_MS = 30000;

class TorManager {
  constructor() {
    this.torProcess = null;
    this.running = false;
    this.starting = false;
    this.dataDir = null;
  }

  /**
   * Locate the Tor binary — either bundled with the app or on the system PATH.
   * @returns {string|null}
   */
  _findTorBinary() {
    // Check bundled locations
    const bundledPaths = [
      path.join(process.resourcesPath || '', 'tor', 'tor'),
      path.join(__dirname, '..', '..', 'tor', 'tor'),
      path.join(__dirname, '..', '..', 'bin', 'tor'),
    ];

    for (const p of bundledPaths) {
      if (p && fs.existsSync(p)) return p;
    }

    // Fall back to system PATH (just 'tor')
    return 'tor';
  }

  /**
   * Start the Tor daemon.
   * Creates an in-memory data directory and spawns tor with SOCKS on 127.0.0.1:9050.
   * @returns {Promise<void>}
   */
  async start() {
    if (this.running || this.starting) return;
    this.starting = true;

    // Use a temporary directory for Tor data (wiped on exit)
    this.dataDir = path.join(require('os').tmpdir(), `tor-secure-browser-${Date.now()}`);
    fs.mkdirSync(this.dataDir, { recursive: true });

    const torBinary = this._findTorBinary();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.running) {
          this.starting = false;
          reject(new Error('Tor startup timed out'));
        }
      }, STARTUP_TIMEOUT_MS);

      try {
        this.torProcess = spawn(torBinary, [
          '--SocksPort', String(TOR_SOCKS_PORT),
          '--ControlPort', String(TOR_CONTROL_PORT),
          '--DataDirectory', this.dataDir,
          '--Log', 'notice stdout',
          '--AvoidDiskWrites', '1',
          '--ClientUseIPv4', '1',
          '--DNSPort', '0',  // DNS handled via SOCKS
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.torProcess.stdout.on('data', (data) => {
          const line = data.toString().trim();
          console.log('[Tor]', line);
          // Tor is ready when it logs "Bootstrapped 100%"
          if (line.includes('Bootstrapped 100%')) {
            this.running = true;
            this.starting = false;
            clearTimeout(timeout);
            console.log('[TorManager] Tor is fully bootstrapped and ready');
            resolve();
          }
        });

        this.torProcess.stderr.on('data', (data) => {
          console.error('[Tor stderr]', data.toString().trim());
        });

        this.torProcess.on('error', (err) => {
          clearTimeout(timeout);
          this.starting = false;
          console.error('[TorManager] Failed to spawn Tor:', err.message);
          reject(new Error(`Failed to start Tor: ${err.message}. Ensure Tor is installed or bundled.`));
        });

        this.torProcess.on('exit', (code) => {
          console.log(`[TorManager] Tor process exited with code ${code}`);
          this.running = false;
          this.starting = false;
          clearTimeout(timeout);
        });

        // Also poll the SOCKS port as a readiness check
        this._waitForPort(TOR_SOCKS_PORT, 15000).then(() => {
          if (!this.running) {
            this.running = true;
            this.starting = false;
            clearTimeout(timeout);
            console.log('[TorManager] Tor SOCKS port is accepting connections');
            resolve();
          }
        }).catch(() => {
          // Port polling is a fallback; the stdout log is the primary signal
        });
      } catch (err) {
        clearTimeout(timeout);
        this.starting = false;
        reject(err);
      }
    });
  }

  /**
   * Gracefully stop the Tor daemon and clean up.
   */
  async stop() {
    if (!this.torProcess) return;

    return new Promise((resolve) => {
      this.torProcess.on('exit', () => {
        this.running = false;
        // Clean up data directory
        if (this.dataDir && fs.existsSync(this.dataDir)) {
          try {
            fs.rmSync(this.dataDir, { recursive: true, force: true });
          } catch (e) {
            console.warn('[TorManager] Could not clean up data dir:', e.message);
          }
        }
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      this.torProcess.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.torProcess) {
          try {
            this.torProcess.kill('SIGKILL');
          } catch (e) {
            // already dead
          }
        }
      }, 5000);
    });
  }

  isRunning() {
    return this.running;
  }

  getStatus() {
    return {
      running: this.running,
      starting: this.starting,
      socksPort: TOR_SOCKS_PORT,
      controlPort: TOR_CONTROL_PORT,
    };
  }

  /**
   * Poll a TCP port until it accepts connections or times out.
   */
  _waitForPort(port, timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', () => {
          socket.destroy();
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Port ${port} not reachable`));
          } else {
            setTimeout(check, 500);
          }
        });
        socket.on('timeout', () => {
          socket.destroy();
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Port ${port} timed out`));
          } else {
            setTimeout(check, 500);
          }
        });
        socket.connect(port, '127.0.0.1');
      };
      check();
    });
  }
}

module.exports = TorManager;
