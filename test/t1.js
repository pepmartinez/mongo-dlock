var MDL = require('../');
var async = require('async');
var should = require('should');

describe('Mongo-DLock test', function () {
  before(function (done) {
    done();
  });

  after(function (done) {
    done();
  });

  it('locks & unlocks fine', function (done) {
    MDL ({}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, true]);
        l1._local_locked.should.equal (false);
        done (err);
      });
    });
  });
});
