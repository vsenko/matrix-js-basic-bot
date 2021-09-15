# matrix-js-basic-bot

**Note: this code is outdated and, probably, broken!**

[![Build Status](https://travis-ci.org/vsenko/matrix-js-basic-bot.svg?branch=master)](https://travis-ci.org/vsenko/matrix-js-basic-bot)

A basic bot for matrix.org

It can be used to run basic experiments in chat bot development without going deep in [matrix](https://matrix.org/docs/spec) protocol details.

Bot is powered by [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk).

Features:
- on first startup authenticates and obtains *access token* and *device id*, stores them to use on subsequent runs
- automatically joins rooms on invitation
- automatically leaves empty rooms
- supports e2e encryption
- automatically verifies all users devices in the room on an attempt to send a message to the e2e enabled room

## Usage

```
npm install matrix-js-basic-bot
```

```javascript
const BasicMatrixBot = require('matrix-js-basic-bot');
const md = require('markdown-it')();

async function onMessage(content, sender) {
  try {
    const output = `**Echo**: ${content.body}`;
    await this.sendHtmlNotice(sender.roomId, output, md.render(output));
  } catch (error) {
    console.log(error);
  }
}

async function run() {
  await servers.connect(serversCredentials);

  const bot = new BasicMatrixBot('myCoolBot', 'StrongPassword', 'https://matrix.org', './localstorage');

  bot.on('error', (error) => {
    console.log(error);
  });

  bot.on('message', onMessage);
  bot.on('e2eMessage', onMessage);

  await bot.start();
}

run()
  .catch((error) => {
    console.log('Unhandled error!');
    console.log(error);
    process.exit(1);
  });

```

See more examples in [examples](/examples).

## API
[docs](/docs)

## License
MIT
