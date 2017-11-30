const EventEmitter = require('events');

global.Olm = require('olm');
const sdk = require('matrix-js-sdk');
const { LocalStorage } = require('node-localstorage');

/**
 * Class implementing a matrix bot.
 *
 * @extends EventEmitter
 */
class BasicMatrixBot extends EventEmitter {
  /**
   * Create a bot.
   *
   * @param {string} userId - matrix user id.
   * @param {string} password - matrix user password.
   * @param {string} url - homeserver url.
   * @param {string} storagePath - filesystem path to store permanent data (access token,
   * device id, e2e keys), should point to a folder which already exists or will be created on
   * first launch.
   * @param {Object} [options] - configuration options
   * @param {string[] | string} options.messageTypes - message types to emit events on
   * (https://matrix.org/docs/spec/client_server/r0.3.0.html#m-room-message-msgtypes)
   * , default `['m.text']`
   * @param {boolean} options.automaticallyJoinRooms - whether bot should automatically join rooms
   * on invitations, defaults to `true`.
   * @param {boolean} options.automaticallyLeaveRooms - whether bot should automatically leave rooms
   * when it is the last room member, defaults to `true`.
   * @param {boolean} options.automaticallyVerifyDevices - whether bot should automatically verify
   * devices in case if a message could not be sent to an encrypted room, defaults to `true`.
   */
  constructor(userId, password, url, storagePath, options) {
    super();

    if (!userId || typeof userId !== 'string') {
      throw new Error('"userId" is required and must be a string.');
    }
    this.userId = userId;

    if (!password || typeof password !== 'string') {
      throw new Error('"password" is required and must be a string.');
    }
    this.password = password;

    if (!url || typeof url !== 'string') {
      throw new Error('"storagePath" is required and must be a string.');
    }
    this.localStorage = new LocalStorage(storagePath);

    if (!url || typeof url !== 'string') {
      throw new Error('"url" is required and must be a string.');
    }
    this.clientOptions = {
      baseUrl: url,
      sessionStore: new sdk.WebStorageSessionStore(this.localStorage),
    };

    // Parse options
    this.messageTypes = ['m.text'];
    this.automaticallyJoinRooms = true;
    this.automaticallyLeaveRooms = true;
    this.automaticallyVerifyDevices = true;

    if (options && typeof options === 'object') {
      if (options.messageTypes
      && !Array.isArray(options.messageTypes)
      && typeof options.messageTypes !== 'string') {
        throw new Error('"messageTypes" should be a string or an array.');
      }
      this.messageTypes = options.messageTypes || ['m.text'];
      if (typeof this.messageTypes === 'string') {
        this.messageTypes = [this.messageTypes];
      }

      if (options.automaticallyJoinRooms === false) {
        this.automaticallyJoinRooms = false;
      }

      if (options.automaticallyLeaveRooms === false) {
        this.automaticallyLeaveRooms = false;
      }

      if (options.automaticallyVerifyDevices === false) {
        this.automaticallyVerifyDevices = false;
      }
    }

    this.matrixClient = null;
  }

  /**
   * Start bot.
   */
  async start() {
    if (!this.localStorage.getItem('accessToken')) {
      const loginClient = sdk.createClient(this.clientOptions);

      const loginResult = await loginClient.loginWithPassword(this.userId, this.password);

      this.localStorage.setItem('accessToken', loginResult['access_token']); // eslint-disable-line dot-notation
      this.localStorage.setItem('userId', loginResult['user_id']); // eslint-disable-line dot-notation
      this.localStorage.setItem('deviceId', loginResult['device_id']); // eslint-disable-line dot-notation

      loginClient.stopClient();
    }

    this.clientOptions.accessToken = this.localStorage.getItem('accessToken');
    this.clientOptions.userId = this.localStorage.getItem('userId');
    this.clientOptions.deviceId = this.localStorage.getItem('deviceId');

    this.matrixClient = sdk.createClient(this.clientOptions);
    await this.matrixClient.initCrypto();
    this.matrixClient.startClient();

    this.matrixClient.on('sync', (state, prevState, data) => {
      switch (state) {
        case 'PREPARED':
          this.setupAutomaticActions();
          this.emit('connected');
          break;
        case 'ERROR':
          this.emit('error', data.err);
          break;
        default:
      }
    });
  }

  /**
   * Do a clean shutdown.
   */
  stop() {
    this.matrixClient.stopClient();
  }

  /**
   * Setup bot. This is an internal function and should not be called.
   */
  setupAutomaticActions() {
    this.matrixClient.on('RoomMember.membership', async (event, member) => {
      try {
        if (this.automaticallyJoinRooms
          && member.membership === 'invite'
          && member.userId === this.clientOptions.userId) {
          await this.joinRoom(member.roomId);
        }

        if (this.automaticallyLeaveRooms
          && (member.membership === 'leave' || member.membership === 'ban')) {
          const rooms = await this.matrixClient.getRooms();
          for (const room of rooms) { // eslint-disable-line no-restricted-syntax
            const members = await room.getJoinedMembers();

            if (members.length === 1) {
              await this.leaveRoom(room.roomId);
            }
          }
        }
      } catch (error) {
        this.emit('error', error);
      }

      this.emit('membership', event, member);
    });

    this.matrixClient.on('Room.timeline', async (event, room, toStartOfTimeline) => {
      try {
        if (toStartOfTimeline) {
          return; // skip paginated results
        }

        if (event.getType() !== 'm.room.message') {
          return;
        }

        const content = event.getContent();

        if (!this.messageTypes.includes(content.msgtype)) {
          return;
        }

        this.emit('message', content, event.sender, event);
      } catch (error) {
        this.emit('error', error);
      }
    });

    this.matrixClient.on('Event.decrypted', async (event) => {
      try {
        if (event.getType() !== 'm.room.message') {
          return;
        }

        const content = event.getContent();

        if (!this.messageTypes.includes(content.msgtype)) {
          return;
        }

        this.emit('e2eMessage', content, event.sender, event);
      } catch (error) {
        this.emit('error', error);
      }
    });
  }

  /**
   * Verify user's device. Basically it means that the bot can trust remote user's e2e keys.
   *
   * @param {string} userId - user id.
   * @param {string} deviceId - device body.
   */
  async verifyDevice(userId, deviceId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('"userId" is required and must be a string.');
    }

    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('"deviceId" is required and must be a string.');
    }

    await this.matrixClient.setDeviceKnown(userId, deviceId, true);
    await this.matrixClient.setDeviceVerified(userId, deviceId, true);
  }

  /**
   * Send [notice](https://matrix.org/docs/spec/client_server/r0.3.0.html#m-notice) to a specified
   * room. It is preferred for bots to send notices as it is stated in the spec.
   *
   * @param {string} roomId - room id.
   * @param {string} body - notification body.
   * @param {string} [htmlBody] - notification body in HTML.
   */
  async sendNotice(roomId, body, htmlBody) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    if (!body || typeof body !== 'string') {
      throw new Error('"body" is required and must be a string.');
    }

    if (htmlBody && typeof htmlBody !== 'string') {
      throw new Error('"htmlBody" must be a string.');
    }

    const functionToUse = htmlBody ? 'sendHtmlNotice' : 'sendNotice';

    try {
      await this.matrixClient[functionToUse](roomId, body, htmlBody);
    } catch (error) {
      if (this.automaticallyVerifyDevices
      && error.name && error.name === 'UnknownDeviceError'
      && error.devices && typeof error.devices === 'object') {
        // eslint-disable-next-line no-restricted-syntax
        for (const userId of Object.keys(error.devices)) {
          // eslint-disable-next-line no-restricted-syntax
          for (const deviceId of Object.keys(error.devices[userId])) {
            this.verifyDevice(userId, deviceId);
          }
        }

        await this.matrixClient[functionToUse](roomId, body, htmlBody);
      } else {
        throw error;
      }
    }
  }

  /**
   * Send [message](https://matrix.org/docs/spec/client_server/r0.3.0.html#m-text) to a specified
   * room.
   *
   * @param {string} roomId - room id.
   * @param {string} body - notification body.
   * @param {string} [htmlBody] - notification body in HTML.
   */
  async sendMessage(roomId, body, htmlBody) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    if (!body || typeof body !== 'string') {
      throw new Error('"body" is required and must be a string.');
    }

    if (htmlBody && typeof htmlBody !== 'string') {
      throw new Error('"htmlBody" must be a string.');
    }

    const functionToUse = htmlBody ? 'sendHtmlMessage' : 'sendTextMessage';

    try {
      await this.matrixClient[functionToUse](roomId, body, htmlBody);
    } catch (error) {
      if (this.automaticallyVerifyDevices
      && error.name && error.name === 'UnknownDeviceError'
      && error.devices && typeof error.devices === 'object') {
        // eslint-disable-next-line no-restricted-syntax
        for (const userId of Object.keys(error.devices)) {
          // eslint-disable-next-line no-restricted-syntax
          for (const deviceId of Object.keys(error.devices[userId])) {
            this.verifyDevice(userId, deviceId);
          }
        }

        await this.matrixClient[functionToUse](roomId, body, htmlBody);
      } else {
        throw error;
      }
    }
  }

  /**
   * Send [emote](https://matrix.org/docs/spec/client_server/r0.3.0.html#m-emote) to a specified
   * room.
   *
   * @param {string} roomId - room id.
   * @param {string} body - notification body.
   * @param {string} [htmlBody] - notification body in HTML.
   */
  async sendEmote(roomId, body, htmlBody) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    if (!body || typeof body !== 'string') {
      throw new Error('"body" is required and must be a string.');
    }

    if (htmlBody && typeof htmlBody !== 'string') {
      throw new Error('"htmlBody" must be a string.');
    }

    const functionToUse = htmlBody ? 'sendHtmlEmote' : 'sendEmoteMessage';

    try {
      await this.matrixClient[functionToUse](roomId, body, htmlBody);
    } catch (error) {
      if (this.automaticallyVerifyDevices
      && error.name && error.name === 'UnknownDeviceError'
      && error.devices && typeof error.devices === 'object') {
        // eslint-disable-next-line no-restricted-syntax
        for (const userId of Object.keys(error.devices)) {
          // eslint-disable-next-line no-restricted-syntax
          for (const deviceId of Object.keys(error.devices[userId])) {
            this.verifyDevice(userId, deviceId);
          }
        }

        await this.matrixClient[functionToUse](roomId, body, htmlBody);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create new room.
   *
   * Passes `options` directly to `MatrixClient.createRoom` (http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-client-MatrixClient.html).
   *
   * @param {object} options - room options, see `createRoom` (http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-client-MatrixClient.html)
   * @param {string} options.room_alias_name
   * @param {string} options.visibility
   * @param {string[]} options.invite
   * @param {string} options.name
   * @param {string} options.topic
   * @returns {object} - `{room_id: {string}, room_alias: {string(opt)}}`
   */
  async createRoom(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('"options" is required and must be an object.');
    }

    return this.matrixClient.createRoom(options);
  }


  /**
   * List known rooms.
   *
   * @returns {object[]} - array of known rooms represented as room objects
   */
  async listKnownRooms() {
    return this.matrixClient.getRooms();
  }

  /**
   * Join room.
   *
   * @param {string} roomId - room id.
   */
  async joinRoom(roomId) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    await this.matrixClient.joinRoom(roomId);
  }

  /**
   * Invite user to room.
   *
   * @param {string} userId - user id.
   * @param {string} roomId - room id.
   */
  async inviteUserToRoom(userId, roomId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('"userId" is required and must be a string.');
    }

    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    await this.matrixClient.invite(roomId, userId);
  }

  /**
   * Leave and forget room.
   *
   * @param {string} roomId - room id.
   */
  async leaveRoom(roomId) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('"roomId" is required and must be a string.');
    }

    await this.matrixClient.leave(roomId);
    await this.matrixClient.forget(roomId);
  }
}

/**
 * Connected event. Fires after `'PREPARED'` state was reported
 * (http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-client.html#~event:MatrixClient%2522sync%2522).
 *
 * @event BasicMatrixBot#connected
 */

/**
 * Error event. Fires whenever an error occurs.
 *
 * @event BasicMatrixBot#error
 * @param {object} error
 */

/**
 * Membership event. Fires whenever room membership of any known to the bot rooms changes
 * http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-client.html#~event:MatrixClient%2522RoomMember.membership%2522).
 *
 * @event BasicMatrixBot#membership
 * @param {object} event
 * @param {object} member
 */

/**
 * Message event. Fires whenever there is a new message in any room the bot has joined. Messages
 * are filtered using `options.messageTypes` provided in constructor.
 *
 * @event BasicMatrixBot#message
 * @param {object} content - obtained using `event.getContent()`, usually contains these properties:
 * @param {string} content.body - message text.
 * @param {string} content.msgtype - [message type](https://matrix.org/docs/spec/client_server/r0.3.0.html#m-room-message-msgtypes).
 * @param {object} sender - `event.sender` [RoomMember](http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-models_room-member.html)
 * , usually contains at least these properties:
 * @param {string} sender.roomId - room id.
 * @param {string} sender.userId - user id.
 * @param {object} event - raw `event`.
 */

/**
 * e2e message event. Fires whenever there is a new encrypted message in any room the bot has
 * joined. Messages are filtered using `options.messageTypes` provided in constructor.
 *
 * @event BasicMatrixBot#e2eMessage
 * @param {string} content.body - message text.
 * @param {string} content.msgtype - [message type](https://matrix.org/docs/spec/client_server/r0.3.0.html#m-room-message-msgtypes).
 * @param {object} sender - `event.sender` [RoomMember](http://matrix-org.github.io/matrix-js-sdk/0.9.1/module-models_room-member.html)
 * , usually contains at least these properties:
 * @param {string} sender.roomId - room id.
 * @param {string} sender.userId - user id.
 * @param {object} event - raw `event`.
 */

module.exports = BasicMatrixBot;
