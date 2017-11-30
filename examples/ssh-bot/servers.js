/* eslint-disable no-console, import/no-extraneous-dependencies, import/no-unresolved */
const { Client } = require('ssh2');

const connections = new Map();


async function closeAll() {
  connections.forEach((connection) => {
    connection.end();
  });
  connections.clear();
}
exports.closeAll = closeAll;


async function connect(serversCredentials) {
  await closeAll();

  for (const serverCredentials of serversCredentials) { // eslint-disable-line no-restricted-syntax
    const connection = new Client();

    await new Promise((resolve, reject) => {
      connection.once('ready', () => {
        connection.removeListener('error', reject);
        resolve();
      });
      connection.once('error', (error) => {
        connection.removeListener('ready', resolve);
        reject(error);
      });
      connection.connect(serverCredentials);
    });

    connections.set(serverCredentials.name, connection);
  }
}
exports.connect = connect;


async function exec(serverName, command) {
  const connection = connections.get(serverName);
  if (!connection) {
    throw new Error(`Unknown server name: "${serverName}"`);
  }

  return new Promise((resolve, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let output = '';
      stream
        .on('close', () => {
          resolve(output);
        })
        .on('data', (data) => {
          output += data;
        })
        .stderr.on('data', (data) => {
          output += data;
        });
    });
  });
}
exports.exec = exec;
