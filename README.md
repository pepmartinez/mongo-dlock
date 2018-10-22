# mongo-dlock
distributed lock on top of mongodb for node.js. It provides an implementation of a distributed lock using mongodb as both state and event stream

## Features
* behind-the scenes lock retry or one-shot lock try
* uses mongodb ttl index to safeguard deletion of stray locks
* distributed event stream for lock & unlock (exported as eventEmitter). The lock retry loop uses it internally to retry locks when they are released elsewhere

## Quickstart
```js
const MDL = require ('mongo-dlock');
const opts = {...};

MDL (opts, (err, Locks) => {
  if (err) {
    // manage error
  }
      
  var l1 = Locks.dlock ('some-task');

  l1.wait_lock (err => {
    // do whatever the task is...

    l1.unlock (err => {
      ...
    })
  });
```

## API

## Locks for long-running tasks
