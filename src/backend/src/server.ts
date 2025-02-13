/**
 * @fileoverview Entry point for the MGA Operating System backend server
 * Implements high availability, monitoring, and enhanced security features
 * @version 1.0.0
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import cluster from 'cluster';
import os from 'os';
import { createLogger } from './config/logger';
import app from './app';
import { metricsManager } from './utils/metrics';

// Initialize logger
const logger = createLogger();

// Environment configuration
const HTTP_PORT = parseInt(process.env.PORT || '3000');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443');
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || os.cpus().length.toString());

/**
 * Creates HTTPS server with enhanced SSL/TLS configuration
 */
const createHttpsServer = (): https.Server => {
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || 'certs/server.key'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'certs/server.crt'),
    ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined,
    secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    minVersion: 'TLSv1.3',
    honorCipherOrder: true,
    requestCert: false,
    rejectUnauthorized: true
  };

  return https.createServer(sslOptions, app);
};

/**
 * Configures Node.js clustering for high availability
 */
const setupCluster = (): void => {
  if (cluster.isPrimary) {
    logger.info(`Primary ${process.pid} is running`);

    // Fork workers based on CPU count
    for (let i = 0; i < WORKER_COUNT; i++) {
      cluster.fork();
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}`);
      // Replace dead worker
      cluster.fork();
    });

    // Zero-downtime restart handler
    process.on('SIGUSR2', () => {
      logger.info('Received SIGUSR2 - Initiating zero-downtime restart');
      const workers = Object.values(cluster.workers || {});
      
      let restartCount = 0;
      workers.forEach(worker => {
        worker?.on('exit', () => {
          restartCount++;
          if (restartCount === workers.length) {
            logger.info('All workers restarted successfully');
          }
        });
        worker?.send('shutdown');
      });
    });
  } else {
    startServer();
  }
};

/**
 * Initializes comprehensive monitoring system
 */
const setupMonitoring = (httpServer: http.Server, httpsServer: https.Server): void => {
  // Initialize server metrics
  metricsManager.recordAPIMetrics({
    method: 'SYSTEM',
    path: '/startup',
    statusCode: 200,
    responseTime: 0,
    requestSize: 0,
    responseSize: 0
  });

  // Monitor server events
  [httpServer, httpsServer].forEach(server => {
    server.on('connection', socket => {
      socket.setKeepAlive(true);
      socket.setNoDelay(true);
    });

    server.on('error', error => {
      logger.error('Server error occurred', error);
    });

    server.on('clientError', (error, socket) => {
      logger.error('Client connection error', error);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  });
};

/**
 * Configures enhanced graceful shutdown handlers
 */
const setupGracefulShutdown = (httpServer: http.Server, httpsServer: https.Server): void => {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} - Starting graceful shutdown`);

    // Stop accepting new connections
    httpServer.close();
    httpsServer.close();

    // Implement connection draining
    const drainTimeout = setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    try {
      // Close existing connections
      const servers = [httpServer, httpsServer];
      await Promise.all(servers.map(server => 
        new Promise(resolve => server.close(resolve))
      ));

      // Cleanup resources
      clearTimeout(drainTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('message', msg => {
    if (msg === 'shutdown') {
      shutdown('WORKER_SHUTDOWN');
    }
  });
};

/**
 * Initializes and starts the server with all features
 */
const startServer = async (): Promise<void> => {
  try {
    // Create HTTP server (redirect to HTTPS)
    const httpServer = http.createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
      res.end();
    });

    // Create HTTPS server
    const httpsServer = createHttpsServer();

    // Setup monitoring
    setupMonitoring(httpServer, httpsServer);

    // Start listening
    await Promise.all([
      new Promise(resolve => httpServer.listen(HTTP_PORT, resolve)),
      new Promise(resolve => httpsServer.listen(HTTPS_PORT, resolve))
    ]);

    // Setup graceful shutdown
    setupGracefulShutdown(httpServer, httpsServer);

    logger.info('Server started successfully', {
      httpPort: HTTP_PORT,
      httpsPort: HTTPS_PORT,
      workerId: cluster.worker?.id,
      pid: process.pid
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Start server with clustering
setupCluster();

export { startServer };