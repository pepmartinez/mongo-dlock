var _ =            require ('lodash');
var async =        require ('async');
var uuid =         require ('uuid');
var MongoClient =  require ('mongodb').MongoClient;




/*

lock: entry in db.coll:
 {
   _id: id , lock id
   lock:   , true | false
   ct:      , creat time
   et:      , exp time
 }


 ttl index on exp + grace-period


 lock: upsert (_id=id, lock=false OR et=in-past) -> set (lock=true, ct: now, et:now+delta)
   ok if no error
   no lock if dup, or (upserted = 0 and  modified = 0)
 unlock: remove (_id, lock=true)
*/

//////////////////////////////////////////////
var DLock = function (id, mdl) {
  this._id = id;
  this._mdl = mdl;
  this._local_locked = false;
}


//////////////////////////////////////////////
DLock.prototype.lock = function (cb) {
  if (this._local_locked) setImmediate (function () {
    // recursive lock not allowed
    cb (null, false);
  });

  var q = {
    _id:   this._id,
    $or: [
      {lockd: false},
      {et: {$lt: new Date ()}}
    ]
  };

  var upd = {
    $set: {
      lockd: true,
      ct:    new Date (),
      et:    new Date (new Date ().getTime () + 30000)
    }
  };

  this._mdl._coll.updateOne (q, upd, {upsert: true}, (err, res) => {
    if (err) {
      if (err.code && (11000 == err.code)) {
        console.log ('%s duplicated, lock failed', this._id);
        return cb (null, false);
      }
    }
    else {
      if (res.modifiedCount) {
        console.log ('%s modified, lock acquired', this._id);
        this._local_locked = true;
        return cb (null, true);
      }

      if (res.upsertedCount) {
        console.log ('%s upserted, lock acquired', this._id);
        this._local_locked = true;
        return cb (null, true);
      }

      console.log ('%s upsert produced no results, lock failed', this._id);
      return cb (null, false);
    }
  });
}


//////////////////////////////////////////////
DLock.prototype.unlock = function (cb) {
  if (!this._local_locked) setImmediate (function () {
    // we do not hold the lock, so do not even try
    cb (null, false);
  });

  var q = {
    _id:   this._id,
    lockd: true
  };

  this._mdl._coll.deleteOne (q, (err, res) => {
    if (err) return cb (err);
    this._local_locked = false;
    return cb (null, (1 == res.deletedCount));
  });
}





//////////////////////////////////////////////
var MongoDLock = function (client, db, coll) {
  this._client = client;
  this._db =     db;
  this._coll =   coll;

  // TODO create ttl index on et
  this._coll.createIndex ({et: 1}, {expireAfterSeconds: 60});
}


//////////////////////////////////////////////
MongoDLock.prototype.dlock = function (id) {
  var l = new DLock (id || uuid.v4 (), this);
  return l;
}


//////////////////////////////////////////////
MongoDLock.prototype.close = function (cb) {
  // TODO release all locks?

  this._client.close (cb);
}


//////////////////////////////////////////////
module.exports = function (opts, cb) {
  var url =      opts.url ||  'mongodb://localhost:27017';
  var dbName =   opts.db ||   'dlocks';
  var collName = opts.coll || 'dlocks';

  MongoClient.connect(url, function (err, client) {
    if (err) return cb (err);
    var db = client.db (dbName);
    var coll = db.collection (collName);

    var mdl = new MongoDLock (client, db, coll);
    cb (null, mdl);
  });
} 
