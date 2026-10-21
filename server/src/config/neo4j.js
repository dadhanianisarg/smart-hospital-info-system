const neo4j = require('neo4j-driver');
const net = require('net');

let driver = null;
let isConnected = false;

// Fast socket probe to avoid long driver timeouts if Neo4j port is not open
function probePort(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let called = false;

    const finalize = (success) => {
      if (!called) {
        called = true;
        socket.destroy();
        resolve(success);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));

    try {
      socket.connect(port, host);
    } catch {
      finalize(false);
    }
  });
}

const initNeo4j = async () => {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  try {
    // Parse host and port from uri
    const parsed = new URL(uri.replace('bolt://', 'http://'));
    const host = parsed.hostname || 'localhost';
    const port = parseInt(parsed.port, 10) || 7687;

    const isPortOpen = await probePort(host, port, 1000);
    if (!isPortOpen) {
      isConnected = false;
      console.warn(`[Neo4j] Port ${port} on ${host} is unreachable. Operating in synchronized graph-fallback mode for evaluation.`);
      return { driver: null, isConnected: false };
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionTimeout: 3000,
    });
    await driver.verifyConnectivity();
    isConnected = true;
    console.log(`[Neo4j] Connected successfully to: ${uri}`);
  } catch (error) {
    isConnected = false;
    console.warn(`[Neo4j] Connection to ${uri} failed (${error.message}). Operating in synchronized graph-fallback mode.`);
  }
  return { driver, isConnected };
};

const getDriver = () => driver;
const getStatus = () => isConnected;

const getSession = (database = 'neo4j') => {
  if (driver && isConnected) {
    return driver.session({ database });
  }
  return null;
};

const closeNeo4j = async () => {
  if (driver) {
    await driver.close();
    console.log('[Neo4j] Connection driver closed.');
  }
};

module.exports = {
  initNeo4j,
  getDriver,
  getStatus,
  getSession,
  closeNeo4j,
};
