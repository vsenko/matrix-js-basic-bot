const assert = require('assert');

const config = require('./config.js');

const BasicMatrixBot = require('../../index.js');

describe('messaging', function suite() {
  this.timeout(config.mochaTimeout);

  let botA;
  let botB;
  let roomId;
  const messageBody = 'abcdefg!';

  afterEach(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestTimeout);
    });
  });

  before(async () => {
    botA = new BasicMatrixBot(
      config.botAId,
      config.botAPass,
      config.homeserverUrl,
      config.botAStorage,
      {
        messageTypes: ['m.text', 'm.emote', 'm.notice'],
      }
    );

    const botAConnectedPromise = new Promise((resolve) => {
      botA.on('connected', resolve);
    });

    botA.on('error', (error) => {
      throw error;
    });

    await botA.start();
    await botAConnectedPromise;

    botB = new BasicMatrixBot(
      config.botBId,
      config.botBPass,
      config.homeserverUrl,
      config.botBStorage,
      {
        messageTypes: ['m.text', 'm.emote', 'm.notice'],
      }
    );

    const botBConnectedPromise = new Promise((resolve) => {
      botB.on('connected', resolve);
    });

    botB.on('error', (error) => {
      throw error;
    });

    await botB.start();
    await botBConnectedPromise;

    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestTimeout);
    });

    const room = await botA.createRoom({
      visibility: 'private',
      name: 'test room',
    });
    roomId = room['room_id']; // eslint-disable-line dot-notation

    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestTimeout);
    });

    await botA.inviteUserToRoom(botB.clientOptions.userId, roomId);
  });

  after(async () => {
    const knownRooms = await botA.listKnownRooms();
    for (const room of knownRooms) { // eslint-disable-line no-restricted-syntax
      await botA.leaveRoom(room.roomId);
    }

    botA.stop();
    botB.stop();
  });

  it('notice', async () => {
    const messagePromise = new Promise((resolve) => {
      botB.once('message', (content, sender) => {
        resolve({ content, sender });
      });
    });

    await botA.sendNotice(roomId, messageBody);

    const message = await messagePromise;
    assert.strictEqual(message.content.body, messageBody);
    assert.strictEqual(message.content.msgtype, 'm.notice');
    assert.strictEqual(message.sender.userId, botA.clientOptions.userId);
    assert.strictEqual(message.sender.roomId, roomId);
  });

  it('message', async () => {
    const messagePromise = new Promise((resolve) => {
      botB.once('message', (content, sender) => {
        resolve({ content, sender });
      });
    });

    await botA.sendMessage(roomId, messageBody);

    const message = await messagePromise;
    assert.strictEqual(message.content.body, messageBody);
    assert.strictEqual(message.content.msgtype, 'm.text');
    assert.strictEqual(message.sender.userId, botA.clientOptions.userId);
    assert.strictEqual(message.sender.roomId, roomId);
  });

  it('emote', async () => {
    const messagePromise = new Promise((resolve) => {
      botB.once('message', (content, sender) => {
        resolve({ content, sender });
      });
    });

    await botA.sendEmote(roomId, messageBody);

    const message = await messagePromise;
    assert.strictEqual(message.content.body, messageBody);
    assert.strictEqual(message.content.msgtype, 'm.emote');
    assert.strictEqual(message.sender.userId, botA.clientOptions.userId);
    assert.strictEqual(message.sender.roomId, roomId);
  });
});
