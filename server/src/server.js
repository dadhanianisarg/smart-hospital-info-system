const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = require('./app');
const { connectMongoDB, closeMongoDB } = require('./config/db');
const { initNeo4j, closeNeo4j } = require('./config/neo4j');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Start HTTP Server immediately
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`Smart Hospital Backend Server running on port ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });

    // Connect databases in background without blocking server availability
    connectMongoDB().catch(err => console.warn('[MongoDB Notice]', err.message));
    initNeo4j().catch(err => console.warn('[Neo4j Notice]', err.message));

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(async () => {
        await closeNeo4j();
        if (closeMongoDB) await closeMongoDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
