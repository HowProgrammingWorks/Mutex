'use strict';

const threads = require('worker_threads');
const { Worker, isMainThread } = threads;

const LOCKED = 0;
const UNLOCKED = 1;

class Mutex {
  constructor(shared, offset = 0, initial = false) {
    this.lock = new Int32Array(shared, offset, 1);
    if (initial) Atomics.store(this.lock, 0, UNLOCKED);
    this.owner = false;
  }

  enter(callback) {
    Atomics.wait(this.lock, 0, LOCKED);
    Atomics.store(this.lock, 0, LOCKED);
    this.owner = true;
    setTimeout(callback, 0);
  }

  leave() {
    if (!this.owner) return;
    Atomics.store(this.lock, 0, UNLOCKED);
    Atomics.notify(this.lock, 0, 1);
    this.owner = false;
    return true;
  }
}

// Usage

if (isMainThread) {
  const buffer = new SharedArrayBuffer(4);
  const mutex = new Mutex(buffer, 0, true);
  console.dir({ mutex });
  new Worker(__filename, { workerData: buffer });
  new Worker(__filename, { workerData: buffer });
} else {
  const { threadId, workerData } = threads;
  const mutex = new Mutex(workerData);
  if (threadId === 1) {
    mutex.enter(() => {
      console.log('Entered mutex');
      setTimeout(() => {
        if (mutex.leave()) {
          console.log('Left mutex');
        }
      }, 100);
    });
  } else if (!mutex.leave()) {
    console.log('Can not leave mutex: not owner');
  }
}
