'use strict';

const {
  Worker, isMainThread, threadId, parentPort
} = require('worker_threads');

const threads = new Set();

const LOCKED = 0;
const UNLOCKED = 1;

class Mutex {
  constructor(resourceName, shared, initial = false) {
    this.resourceName = resourceName;
    this.lock = new Int32Array(shared, 0, 1);
    if (initial) Atomics.store(this.lock, 0, UNLOCKED);
    this.owner = false;
    this.trying = false;
    this.callback = null;
  }

  enter(callback) {
    this.callback = callback;
    this.trying = true;
    this.tryEnter();
  }

  tryEnter() {
    if (!this.callback) return;
    const prev = Atomics.exchange(this.lock, 0, LOCKED);
    if (prev === UNLOCKED) {
      this.owner = true;
      this.trying = false;
      this.callback(this).then(() => {
        this.leave();
      });
      this.callback = null;
    }
  }

  leave() {
    if (!this.owner) return;
    Atomics.store(this.lock, 0, UNLOCKED);
    this.owner = false;
    locks.sendMessage({ kind: 'leave', resourceName: this.resourceName });
  }
}

const locks = {
  resources: new Map(),

  request: (resourceName, callback) => {
    let lock = locks.resources.get(resourceName);
    if (!lock) {
      const buffer = new SharedArrayBuffer(4);
      lock = new Mutex(resourceName, buffer, true);
      locks.resources.set(resourceName, lock);
      locks.sendMessage({ kind: 'create', resourceName, buffer });
    }
    lock.enter(callback);
    return lock;
  },

  sendMessage: message => {
    if (isMainThread) {
      for (const thread of threads) {
        thread.worker.postMessage(message);
      }
    } else {
      parentPort.postMessage(message);
    }
  },

  receiveMessage: message => {
    const { kind, resourceName, buffer } = message;
    if (kind === 'create') {
      const lock = new Mutex(resourceName, buffer);
      locks.resources.set(resourceName, lock);
    }
  }
};

if (!isMainThread) {
  parentPort.on('message', locks.receiveMessage);
}

class Thread {
  constructor() {
    const worker = new Worker(__filename);
    this.worker = worker;
    threads.add(this);
    worker.on('message', message => {
      for (const thread of threads) {
        if (thread.worker !== worker) {
          thread.worker.postMessage(message);
        }
      }
      locks.receiveMessage(message);
    });
  }
}

// Usage

if (isMainThread) {

  new Thread();
  new Thread();

} else {

  locks.request('A', async lock => {
    console.log(`Exclusive A in ${threadId}`);
  });

  setTimeout(() => {
    locks.request('B', async lock => {
      console.log(`Exclusive B in ${threadId}`);
    });
  }, 100);

}
