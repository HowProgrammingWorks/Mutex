'use strict';

const threads = require('worker_threads');
const { Worker, isMainThread } = threads;

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
  const buffer = new SharedArrayBuffer(4);
  const array = new Int8Array(buffer, 0, 2);
  const point = new Point(array, 0, 0);
  console.dir({ buffer, point });
  new Worker(__filename, { workerData: buffer });
  new Worker(__filename, { workerData: buffer });
} else {
  const { threadId, workerData } = threads;
  const array = new Int8Array(workerData, 0, 2);
  const point = new Point(array);
  if (threadId === 1) {
    for (let i = 0; i < 1000000; i++) {
      point.move(1, 1);
    }
  } else {
    for (let i = 0; i < 1000000; i++) {
      point.move(-1, -1);
    }
  }
  console.dir({ point });
}
