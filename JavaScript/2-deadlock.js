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
  }
}

// Usage

if (isMainThread) {
  const buffer = new SharedArrayBuffer(8);
  const mutex1 = new Mutex(buffer, 0, true);
  const mutex2 = new Mutex(buffer, 4, true);
  console.dir({ mutex1, mutex2 });
  new Worker(__filename, { workerData: buffer });
  new Worker(__filename, { workerData: buffer });
} else {
  const { threadId, workerData } = threads;
  const mutex1 = new Mutex(workerData);
  const mutex2 = new Mutex(workerData, 4);

  if (threadId === 1) {
    mutex1.enter(() => {
      console.log('Entered mutex1 from worker1');
      setTimeout(() => {
        mutex2.enter(() => {
          console.log('Entered mutex2 from worker1');
          if (mutex1.leave()) console.log('Left mutex1 from worker1');
          if (mutex2.leave()) console.log('Left mutex2 from worker1');
        });
      }, 100);
    });
  } else {
    mutex2.enter(() => {
      console.log('Entered mutex2 from worker2');
      // Uncomment to fix deadlock
      // if (mutex2.leave()) console.log('Left mutex2 from worker2');
      setTimeout(() => {
        mutex1.enter(() => {
          console.log('Entered mutex1 from worker2');
          if (mutex2.leave()) console.log('Left mutex2 from worker2');
          if (mutex1.leave()) console.log('Left mutex1 from worker2');
        });
      }, 100);
    });
  }

}
