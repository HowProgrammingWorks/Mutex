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

  enter() {
    let prev = Atomics.exchange(this.lock, 0, LOCKED);
    while (prev !== UNLOCKED) {
      Atomics.wait(this.lock, 0, LOCKED);
      prev = Atomics.exchange(this.lock, 0, LOCKED);
    }
    this.owner = true;
  }

  leave() {
    if (!this.owner) return;
    Atomics.store(this.lock, 0, UNLOCKED);
    Atomics.notify(this.lock, 0, 1);
    this.owner = false;
  }
}

class Point {
  constructor(data, x, y) {
    this.data = data;
    if (typeof x === 'number') data[0] = x;
    if (typeof y === 'number') data[1] = y;
  }

  get x() {
    return this.data[0];
  }
  set x(value) {
    this.data[0] = value;
  }

  get y() {
    return this.data[1];
  }
  set y(value) {
    this.data[1] = value;
  }

  move(x, y) {
    this.x += x;
    this.y += y;
  }
}

// Usage

if (isMainThread) {
  const buffer = new SharedArrayBuffer(12);
  const mutex = new Mutex(buffer, 0, true);
  const array = new Int32Array(buffer, 4, 2);
  const point = new Point(array, 0, 0);
  console.dir({ mutex, point });
  new Worker(__filename, { workerData: buffer });
  new Worker(__filename, { workerData: buffer });
} else {
  const { threadId, workerData } = threads;
  const mutex = new Mutex(workerData);
  const array = new Int32Array(workerData, 4, 2);
  const point = new Point(array);
  if (threadId === 1) {
    for (let i = 0; i < 1000000; i++) {
      mutex.enter();
      point.move(1, 1);
      mutex.leave();
    }
    mutex.enter();
    console.dir({ point });
    mutex.leave();
  } else {
    for (let i = 0; i < 1000000; i++) {
      mutex.enter();
      point.move(-1, -1);
      mutex.leave();
    }
    mutex.enter();
    console.dir({ point });
    mutex.leave();
  }
}
