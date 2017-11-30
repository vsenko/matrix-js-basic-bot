## SSH gateway bot

This bot executes commands on configured servers over SSH.

## Disclaimer

**This software is not ready for production usage!** Intended for fun and experimenting.

## Setup

- (optional) copy this folder to any convenient location
- `npm install matrix-js-basic-bot markdown-it ssh2`

## Configuration

- provide your SSH server(s) credentials in `serversCredentials`
- provide your matrix user id(s) in `authorisedSenders`
- configure bot in `new BasicMatrixBot('botUserId', 'botPassword', 'https://matrix.org', './localstorage');`
  - substiture `botUserId` with your bot user id
  - substiture `botPassword` with your bot password
  - substiture `https://matrix.org` with your homeserver url in case you are not using default one
  - substiture `./localstorage` with any valid filesystem path - it will be used to store permanent data such as *access token*, *device id* and *e2e keys*

## Usage

- open any convenient matrix client (ex. [riot](https://riot.im/app/))
- register new user or login with existing credentials (in case of a new user, adjust `authorisedSenders`)
- create a new room and invite your bot
- write a message in the room (ex. `localhost df -h` if your configured `serversCredentials` contain an entry with `name: localhost`)
