'use strict';

const threads = require('node:worker_threads');
const { Worker, isMainThread } = threads;

const THREADS_COUNT = 7;

const LOCKED = 0;
const UNLOCKED = 1;

class Mutex {
  constructor(shared, offset = 0, initial = false) {
    this.lock = new Int32Array(shared, offset, 1);
    if (initial) Atomics.store(this.lock, 0, UNLOCKED);
    this.owner = false;
  }

  enter(callback) {
    console.log(`Wait in worker${threads.threadId}`);
    Atomics.wait(this.lock, 0, LOCKED);
    console.log(`endWait in worker${threads.threadId}`);
    Atomics.store(this.lock, 0, LOCKED);
    this.owner = true;
    setTimeout(callback, 0);
  }

  leave() {
    if (!this.owner) return;
    Atomics.store(this.lock, 0, UNLOCKED);
    Atomics.notify(this.lock, 0, 1);
    this.owner = false;
  }
}

// Usage

if (isMainThread) {
  const buffer = new SharedArrayBuffer(8);
  const mutex1 = new Mutex(buffer, 0, true);
  const mutex2 = new Mutex(buffer, 4, true);
  console.dir({ mutex1, mutex2 });
  for (let i = 0; i < THREADS_COUNT; i++) new Worker(__filename, { workerData: buffer });
} else {
  const { threadId, workerData } = threads;
  const mutex1 = new Mutex(workerData);
  const mutex2 = new Mutex(workerData, 4);

  const lowFrequencyLoop = (delay) => {
    mutex1.enter(() => {
      console.log(`Some useful processing from worker${threadId} based on data locked by mutex1`);
      mutex2.enter(() => {
        console.log(`Some useful processing from worker${threadId} based on data locked by mutex2`);
        setTimeout(() => {
          mutex1.leave();
          console.log(`Left mutex1 from worker${threadId} after some useful process has been done`);
          mutex2.leave();
          console.log(`Left mutex2 from worker${threadId} after some useful process has been done`);
          setTimeout(lowFrequencyLoop, delay, delay);
        }, 2000);
      });
    });
  };

  const highFrequencyLoop = (delay) => {
    mutex1.enter(() => {
      console.log(`Entered mutex1 from worker${threadId}`);
      mutex1.leave();
      console.log(`Left mutex1 from worker${threadId}`);
    });
    mutex2.enter(() => {
      console.log(`Entered mutex2 from worker${threadId}`);
      mutex2.leave();
      console.log(`Left mutex2 from worker${threadId}`);
    });
    setTimeout(highFrequencyLoop, delay, delay);
  };

  if (threadId === THREADS_COUNT) {
    // Only one thread executes low frequent process
    lowFrequencyLoop(1000);
  } else {
    // All other threads executes high frequent processes
    highFrequencyLoop(100);
    // Try to change delay between iterations to 1 ms
    // Look out how livelock preventing useful low frequent process to get access on data locked by Mutex
  }
}
