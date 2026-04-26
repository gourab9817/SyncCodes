/** Set from `initSocket` so HTTP handlers can emit (e.g. chat thread refresh). */
let ioRef = null;

module.exports = {
  setIo(io) {
    ioRef = io;
  },
  getIo() {
    return ioRef;
  },
};
