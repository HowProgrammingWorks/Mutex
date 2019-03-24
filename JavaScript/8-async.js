'use strict';

const threads = require('worker_threads');
const { Worker, isMainThread } = threads;

const LOCKED = 0;
const UNLOCKED = 1;

class Mutex {
  constructor(messagePort, shared, offset = 0, initial = false) {
    this.port = messagePort;
    this.lock = new Int32Array(shared, offset, 1);
    if (initial) Atomics.store(this.lock, 0, UNLOCKED);
    this.owner = false;
    this.trying = false;
    this.resolve = null;
    if (messagePort) {
      messagePort.on('message', kind => {
        if (kind === 'leave' && this.trying) this.tryEnter();
      });
    }
  }

  enter() {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.trying = true;
      this.tryEnter();
    });
  }

  tryEnter() {
    if (!this.resolve) return;
    let prev = Atomics.exchange(this.lock, 0, LOCKED);
    if (prev === UNLOCKED) {
      this.owner = true;
      this.trying = false;
      this.resolve();
      this.resolve = null;
    }
  }

  leave() {
    if (!this.owner) return;
    Atomics.store(this.lock, 0, UNLOCKED);
    this.port.postMessage('leave');
    this.owner = false;
  }
}

class Thread {
  constructor(data) {
    const worker = new Worker(__filename, { workerData: data });
    this.worker = worker;
    Thread.workers.add(worker);
    worker.on('message', kind => {
      for (const next of Thread.workers) {
        if (next !== worker) {
          next.postMessage(kind);
        }
      }
    })
  }
}

Thread.workers = new Set();

// Usage

if (isMainThread) {
  const buffer = new SharedArrayBuffer(4);
  const mutex = new Mutex(null, buffer, 0, true);
  console.dir({ mutex });
  new Thread(buffer);
  new Thread(buffer);
} else {
  const { threadId, workerData, parentPort } = threads;
  const mutex = new Mutex(parentPort, workerData);

  setInterval(() => {
    console.log(`Interval ${threadId}`);
  }, 500);

  const loop = async () => {
    await mutex.enter();
    console.log(`Enter ${threadId}`);
    setTimeout(() => {
      mutex.leave();
      console.log(`Leave ${threadId}`);
      setTimeout(loop, 0);
    }, 5000);
  };
  loop();
}
