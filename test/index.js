/* eslint-disable global-require */

describe('package test', () => {
  require('./test-cases/1-start.js');
  require('./test-cases/2-room-membership.js');
  require('./test-cases/3-room-membership-autojoin.js');
  require('./test-cases/4-room-membership-autoleave.js');
  require('./test-cases/5-messaging.js');
});
