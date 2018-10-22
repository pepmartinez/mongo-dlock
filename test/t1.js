var MDL = require('../');
var async = require('async');
var should = require('should');
var _ = require ('lodash');

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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, true, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, true, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, true, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, true, 666, false, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, 666, false, 666, 666, true, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, undefined, true, true, false, undefined]);
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
        (cb) => l1.unlock (cb),
        (cb) => setTimeout (cb, 100)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([true, undefined, false, false, true, undefined]);
        done (err);
      });
    });
  });


  it('works ok with wait_lock', function (done) {
    MDL ({exp_delta: 1000, wait_lock_period: 1000}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
  
      async.parallel ([
        (cb) => async.series ([
          (cb) => l1.lock (cb),
          (cb) => setTimeout (cb, 3500),
          (cb) => l1.unlock (cb),
          (cb) => setTimeout (cb, 100)
        ], cb),
        (cb) => async.series ([
          (cb) => setTimeout (cb, 100),
          (cb) => l2.wait_lock (cb),
          (cb) => l2.unlock (cb),
          (cb) => setTimeout (cb, 100)
        ], cb)
      ], (err, res) => {
        Locks.close ();
        res.should.eql ([ 
          [ true, undefined, true, undefined ],
          [ undefined, true, true, undefined ] 
        ]);

        done (err);
      });
    });
  });  
  
  it('manages races of 5 participants ok, 10k tries', function (done) {
    MDL ({exp_delta: 1000, wait_lock_period: 1000}, (err, Locks) => {
      if (err) return done (err);
      
      var l1 = Locks.dlock ('some-task');
      var l2 = Locks.dlock ('some-task');
      var l3 = Locks.dlock ('some-task');
      var l4 = Locks.dlock ('some-task');
      var l5 = Locks.dlock ('some-task');
  
      async.timesSeries (10000, 
        function (n, next) {
          async.series ([
            (cb) => async.parallel ([
              (cb) => l1.lock (cb),
              (cb) => l2.lock (cb),
              (cb) => l3.lock (cb),
              (cb) => l4.lock (cb),
              (cb) => l5.lock (cb)
            ], cb),
            (cb) => async.parallel ([
              (cb) => l1.unlock (cb),
              (cb) => l2.unlock (cb),
              (cb) => l3.unlock (cb),
              (cb) => l4.unlock (cb),
              (cb) => l5.unlock (cb)
            ], cb)
          ], (err, res) => {
            res[0].should.eql (res[1]); 

            var locks = 0;
            _.forEach (res[0], (v) => {if (v) locks++})

            locks.should.equal (1);
            next (err);
          });
        },
        function (err) {
          Locks.close ();
          done (err);
        });
    });
  });

});
