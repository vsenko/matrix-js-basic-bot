const config = require('./config.js');

const BasicMatrixBot = require('../../index.js');

describe('startup test', function suite() {
  this.timeout(config.mochaTimeout);

  let botA;
  let botB;

  afterEach(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, config.postTestTimeout);
    });
  });

  it('bots should start', async () => {
    botA = new BasicMatrixBot(
      config.botAId,
      config.botAPass,
      config.homeserverUrl,
      config.botAStorage
    );

    const connectedAPromise = new Promise((resolve) => {
      botA.on('connected', resolve);
    });

    botA.on('error', (error) => {
      throw error;
    });

    await botA.start();

    await connectedAPromise;

    botB = new BasicMatrixBot(
      config.botBId,
      config.botBPass,
      config.homeserverUrl,
      config.botBStorage
    );

    const connectedBPromise = new Promise((resolve) => {
      botB.on('connected', resolve);
    });

    botB.on('error', (error) => {
      throw error;
    });

    await botB.start();

    await connectedBPromise;
  });

  it('bots should stop', async () => {
    botA.stop();
    botB.stop();
  });
});
