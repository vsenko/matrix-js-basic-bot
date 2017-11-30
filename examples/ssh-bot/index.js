/* eslint-disable no-console, import/no-extraneous-dependencies, import/no-unresolved */
const md = require('markdown-it')();

const BasicMatrixBot = require('matrix-js-basic-bot');
const servers = require('./servers.js');

const serversCredentials = [
  {
    name: 'localhost',
    host: 'localhost',
    port: 22,
    username: 'someuser',
    password: 'somepassword',
  },
];

const authorisedSenders = [
  '@sender:matrix.org',
];

async function onMessage(content, sender) {
  try {
    const output = 'I prefer private conversations, please enable *e2e encryption* in this room.';
    await this.sendHtmlNotice(sender.roomId, output, md.render(output));
  } catch (error) {
    console.log(error);
  }
}

async function onE2eMessage(content, sender) {
  try {
    if (!authorisedSenders.includes(sender.userId)) {
      return;
    }

    const message = content.body;

    const serverName = message.substring(0, message.indexOf(' '));
    const command = message.substring(message.indexOf(' ') + 1);

    let output;
    try {
      output = await servers.exec(serverName, command);
      output = `\`\`\`\n${output}\n\`\`\``;
    } catch (error) {
      output = `**${error.toString()}**`;
    }

    await this.sendHtmlNotice(sender.roomId, output, md.render(output));
  } catch (error) {
    console.log(error);
  }
}

async function run() {
  await servers.connect(serversCredentials);

  const bot = new BasicMatrixBot('botUserId', 'botPassword', 'https://matrix.org', './localstorage');

  bot.on('error', (error) => {
    console.log(error);
  });

  bot.on('message', onMessage);
  bot.on('e2eMessage', onE2eMessage);

  await bot.start();
}

run()
  .catch((error) => {
    console.log('Unhandled error!');
    console.log(error);
    process.exit(1);
  });
