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

  it('fails on locked, other obj', function (done) {
    MDL ({}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l2.lock (cb),
        (cb) => {l2._local_locked.should.equal (false); cb (null, 666)},
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, true]);
        l1._local_locked.should.equal (false);
        l2._local_locked.should.equal (false);
        done (err);
      });
    });
  });

  it('fails on locked, same obj', function (done) {
    MDL ({}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, true]);
        l1._local_locked.should.equal (false);
        done (err);
      });
    });
  });

  it('fails on double unlock, same obj', function (done) {
    MDL ({}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l1.unlock (cb),
        (cb) => {l1._local_locked.should.equal (false); cb (null, 666)},
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, true, 666, false]);
        l1._local_locked.should.equal (false);
        done (err);
      });
    });
  });


  it('fails on unlock, different object obj', function (done) {
    MDL ({}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => l2.unlock (cb),
        (cb) => {l1._local_locked.should.equal (true); cb (null, 666)},
        (cb) => {l2._local_locked.should.equal (false); cb (null, 666)},
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, 666, true]);
        l1._local_locked.should.equal (false);
        l2._local_locked.should.equal (false);
        done (err);
      });
    });
  });


  it('can lock past expiration (autorefresh: false)', function (done) {
    MDL ({exp_delta: 1000, autorefresh: false}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => setTimeout (cb, 1500),
        (cb) => l2.lock (cb),
        (cb) => l2.unlock (cb),
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, undefined, true, true, false]);
        done (err);
      });
    });
  });


  it('can not lock past expiration (autorefresh: true)', function (done) {
    MDL ({exp_delta: 1000}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
  
      async.series ([
        (cb) => l1.lock (cb),
        (cb) => setTimeout (cb, 1500),
        (cb) => l2.lock (cb),
        (cb) => l2.unlock (cb),
        (cb) => l1.unlock (cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, undefined, false, false, true]);
        done (err);
      });
    });
  });

});
