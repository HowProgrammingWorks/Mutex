'use strict';

class AsyncMutex {
  #queue = [];
  #held = false;

  enter() {
    if (!this.#held) {
      this.#held = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#queue.push(resolve);
    });
  }

  leave() {
    const next = this.#queue.shift();
    if (next) return void queueMicrotask(next);
    this.#held = false;
  }
}

// Usage

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Account {
  #mutex = new AsyncMutex();
  #balance = 0;

  get balance() {
    return this.#balance;
  }

  async deposit(amount, workTime) {
    await this.#mutex.enter();
    try {
      const before = this.#balance;
      await delay(workTime);
      this.#balance = before + amount;
      return this.#balance;
    } finally {
      this.#mutex.leave();
    }
  }
}

const main = async () => {
  const account = new Account();

  await Promise.all([
    account.deposit(10, 50),
    account.deposit(20, 10),
    account.deposit(30, 5),
  ]);

  console.log(account.balance);
};

main().catch(console.error);
