# mongo-dlock
distributed lock on top of mongodb for node.js. It provides an implementation of a distributed lock using mongodb as both state and event stream

## Features
* behind-the scenes lock retry or one-shot lock try
* uses mongodb ttl index to safeguard deletion of stray locks
* distributed event stream for lock & unlock (exported as eventEmitter). The lock retry loop uses it internally to retry locks when they are released elsewhere. Under the hood, it uses mubsub (pubsub over mongodb capped collections) to provide the pubsub bus

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
      // and close
      Locks.close (err => {...})
    })
  });
```

## API

### `MDL (opts, (err, MongoDLock) => {})`
Initializes the Distributed Lock subsystem. Receives an object with options:
* `url`: mongodb url of the backend DB. Defaults to 'mongodb://localhost:27017'
* `db`: mongodb database to be used as Backend DB. Defaults to 'dlocks'
* `coll`: mongodb collection to store the Distributed Locks. Defaults to 'dlocks'
* `notif_url`: mongodb url (with db) to be used as pubsub stream. Defaults to 'mongodb://localhost:27017/mongo_dlock_notif'
* `notif_channel`: channel (aka collection) to be used for the pubsub . Defaults to 'mongo_dlock_notif'
* `grace`: grace period (in seconds) added to the lock expiration to set the ttl index t mongodb. Defaults to 60
* `exp_delta`: expiration of lock, in milliseconds. Unless autorefreshed, an acquired lock will be valid only for this amount of time. Defaults to 5000;
* `autorefresh`: if set to true, the lock will set an internal loop to autorefresh (that is, renew the expiration). Defaults to undefined
* `wait_lock_period`: period in milliseconds to wait between tries on wait_lock() operations. Defaults to 5000

Upon completion, calls the cb argument as cb (err, MongoDLock). MongoDLock is basically a DLock factory: all actual distributed locks are created using this object

### `DLock <- MongoDLock.dlock (opts)`
Creates and returns a Distributed Lock. Receives an object with options; those not defined will take its default from the opts passed upon MDL initialization:
* `exp_delta`: expiration of lock, in milliseconds. Unless autorefreshed, an acquired lock will be valid only for this amount of time. Defaults to 5000;
* `autorefresh`: if set to true, the lock will set an internal loop to autorefresh (that is, renew the expiration). Defaults to undefined
* `id`: string identifier for the lock. Locks of equal id refer to the same logical lock. If not provided, a new uuid v4 is assigned;
* `wait_lock_period`: period in milliseconds to wait between tries on wait_lock() operations. Defaults to 5000

Alternatively, `opts` can be just an string, in which case it is taken as the `id` parameter

### `MongoDLock.close (err => {})`
Closes the MongoDLock factory. After the cb is invoked the factory is no longer usable. It DOES NOT unlock any of the locks created by it

### `DLock.lock ((err, res) => {}) `
Attempts a lock. If the lock is acquired already (and therefore the call failed to acquire it) res will be `false`. If the lock is acquired correctly, res will be `true`

### `DLock.wait_lock ((err, res) => {}) `
Attempts a lock, but waits and retries internally if the lock is acquired someqhre else. `wait_lock_period` controls how often to retry
If an error occurs in any retry the operation ends and the callback is called with the error
For coherency, the callback is also called with a second `res` parameter as true when the lock is finally acquired

### `DLock.unlock ((err, res) => {})`
releases a lock (which was previously held). Callback is called upon error or upon completion, where res is `true` if the lock was released, `false` if it was not released (but no actual error was seen)

## Events
The DLock objects are EventEmitters and emit `lock` and `unlock` events upon sucessful lock and unlock, but with a twist: events are also distributed thanks to a pubsub bus based on mubsub (that is, pubsub over mongodb capped collections), so when an instance of DLock acquires a lock (or releases it) the event is propagated to *all* instances od DLock with the same id (when they use te same mongodb config, of course)

In both cases, the event comes with a parameter, an object containing the id of the dlock, and whether it's a lock or an unlock

## Implementation details
(TODO)
