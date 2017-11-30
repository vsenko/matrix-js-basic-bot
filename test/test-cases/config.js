/* eslint-disable dot-notation */

module.exports = {
  homeserverUrl: process.env['HOMESERVERURL'] || 'http://localhost:8008',
  botAId: process.env['BOTAID'] || 'botA',
  botAPass: process.env['BOTAPASS'] || 'somepass',
  botAStorage: process.env['BOTASTORAGE'] || './tempA',
  botBId: process.env['BOTBID'] || 'botB',
  botBPass: process.env['BOTBPASS'] || 'somepass',
  botBStorage: process.env['BOTBSTORAGE'] || './tempB',
  postTestCaseTimeout: process.env['POSTTESTCASETIMEOUT'] || 1500,
  mochaTimeout: 60000,
};
