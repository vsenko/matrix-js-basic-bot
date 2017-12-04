const assert = require('assert');

const config = require('./config.js');

const BasicMatrixBot = require('../../index.js');

describe('room membership test', function suite() {
  this.timeout(config.mochaTimeout);

  let botA;
  let botB;
  let roomId;

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
        automaticallyJoinRooms: false,
        automaticallyLeaveRooms: false,
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
        automaticallyJoinRooms: false,
        automaticallyLeaveRooms: false,
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
  });

  after(async () => {
    botA.stop();
    botB.stop();

    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestCaseTimeout);
    });
  });

  it('list known rooms', async () => {
    let knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);

    knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);
  });

  it('create room', async () => {
    await botA.createRoom({
      visibility: 'private',
      name: 'test room',
    });
  });

  it('verify membership', async () => {
    const knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 1);
    ([{ roomId }] = knownRooms);
  });

  it('invite', async () => {
    const invitationPromise = new Promise((resolve) => {
      botB.on('membership', (event, member) => {
        if (member.membership === 'invite'
          && member.userId === botB.clientOptions.userId
          && member.roomId === roomId) {
          resolve();
        }
      });
    });

    await botA.inviteUserToRoom(botB.clientOptions.userId, roomId);

    await invitationPromise;
  });

  it('join', async () => {
    await botB.joinRoom(roomId);
  });

  it('verify membership', async () => {
    const knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 1);
    assert.strictEqual(knownRooms[0].roomId, roomId);
  });

  it('leave', async () => {
    let knownRooms = await botA.listKnownRooms();
    for (const room of knownRooms) { // eslint-disable-line no-restricted-syntax
      await botA.leaveRoom(room.roomId);
    }

    knownRooms = await botB.listKnownRooms();
    for (const room of knownRooms) { // eslint-disable-line no-restricted-syntax
      await botB.leaveRoom(room.roomId);
    }
  });

  it('verify membership', async () => {
    let knownRooms = await botA.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);

    knownRooms = await botB.listKnownRooms();
    assert.strictEqual(knownRooms.length, 0);
  });
});
