var _ =            require ('lodash');
var uuid =         require ('uuid');
var MongoClient =  require ('mongodb').MongoClient;



//////////////////////////////////////////////
var DLock = function (mdl, opts) {
  this._exp_delta = opts.exp_delta || 5000;
  this._autorefresh = _.isBoolean (opts.autorefresh) ? opts.autorefresh : true;
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
      } else if (res.upsertedCount) {
        console.log ('%s upserted, lock acquired', this._id);
        this._local_locked = true;
      }
      else {
        console.log ('%s upsert produced no results, lock failed', this._id);
        this._local_locked = false;
      }
      
      if (this._autorefresh && this._local_locked) {
        // set autorefresh
        this._set_autorefresh ();
      }

      return cb (null, this._local_locked);
    }
  });
}


//////////////////////////////////////////////
DLock.prototype._set_autorefresh = function (cb) {
  var self = this;

  this._autorefresh_timer = setTimeout (() => {
    console.log ('firing refresh');

    self._refresh ((err, res) => {
      if (err || !res) {

      }
      else {
        self._set_autorefresh ();
      }
    });
  }, this._exp_delta * 80 / 100);
}


//////////////////////////////////////////////
DLock.prototype._clear_autorefresh = function () {
  if (this._autorefresh_timer) {
    clearTimeout(this._autorefresh_timer);
    this._autorefresh_timer = null;
  }
}


//////////////////////////////////////////////
DLock.prototype._refresh = function (cb) {
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
    this._clear_autorefresh ();
    return cb (null, (1 == res.deletedCount));
  });
}



//////////////////////////////////////////////
var MongoDLock = function (client, db, coll, opts) {
  this._client = client;
  this._db =     db;
  this._coll =   coll;
  this._opts =   opts;

  // create ttl index on et
  this._coll.createIndex ({et: 1}, {expireAfterSeconds: (opts.grace || 60)});
}


//////////////////////////////////////////////
MongoDLock.prototype.dlock = function (opts) {
  var the_opts = {};
  if (!opts) the_opts = this._opts;
  else if (_.isString (opts)) _.merge (the_opts, this._opts, {id: opts});
  else _.merge (the_opts, this._opts);
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

  MongoClient.connect(url, { useNewUrlParser: true }, function (err, client) {
    if (err) return cb (err);
    var db = client.db (dbName);
    var coll = db.collection (collName);

    var mdl = new MongoDLock (client, db, coll, opts);
    cb (null, mdl);
  });
} 
