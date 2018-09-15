var _ =            require ('lodash');
var uuid =         require ('uuid');
var MongoClient =  require ('mongodb').MongoClient;



//////////////////////////////////////////////
var DLock = function (mdl, opts) {
  this._exp_delta = opts.exp_delta || 30000;
  this._id = opts.id || uuid.v4 ();
  this._mdl = mdl;
  this._local_locked = false;
}


//////////////////////////////////////////////
DLock.prototype.lock = function (cb) {
  if (this._local_locked) return setImmediate (function () {
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
      et:    new Date (new Date ().getTime () + this._exp_delta)
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
DLock.prototype.refresh = function (cb) {
  if (!this._local_locked) return setImmediate (function () {
    // we do not hold the lock, so do not even try
    cb (null, false);
  });

  var q = {
    _id:   this._id,
    lockd: true
  };
  
  var upd = {
    $set: {
      et: new Date (new Date ().getTime () + this._exp_delta)
    }
  };

  this._mdl._coll.updateOne (q, upd, (err, res) => {
    if (err) {
      if (err.code && (11000 == err.code)) {
        console.log ('%s duplicated, lock refresh failed', this._id);
        return cb (null, false);
      }
    }
    else {
      if (res.modifiedCount) {
        console.log ('%s modified, lock refreshed', this._id);
        return cb (null, true);
      }

      console.log ('%s update produced no results, lock refresh failed', this._id);
      return cb (null, false);
    }
  });
}


//////////////////////////////////////////////
DLock.prototype.unlock = function (cb) {
  if (!this._local_locked) return setImmediate (function () {
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
var MongoDLock = function (client, db, coll, opts) {
  this._client = client;
  this._db =     db;
  this._coll =   coll;

  // create ttl index on et
  this._coll.createIndex ({et: 1}, {expireAfterSeconds: (opts.grace || 60)});
}


//////////////////////////////////////////////
MongoDLock.prototype.dlock = function (opts) {
  var the_opts;
  if (!opts) the_opts = {};
  else if (_.isString (opts)) the_opts = {id: opts};
  var l = new DLock (this, the_opts);
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

    var mdl = new MongoDLock (client, db, coll, opts);
    cb (null, mdl);
  });
} 
