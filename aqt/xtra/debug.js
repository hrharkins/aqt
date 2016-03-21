// aqt/debug.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/debug',
['aqt#AQT'],
function(AQT)
{

    //////////////////////////////////////////////////////////////////////////
    
    var benchmark = AQT.benchmark = function(fn, args, opts)
    {
        var prepare = function() { return args };
        if (typeof args === 'function')
        {
            prepare = args;
        }
        else if (args === undefined)
        {
            args = [];
        }
        else if (! (args instanceof Array))
        {
            args = [args];
        }
        opts = opts === undefined ? {} : opts;
        reps = opts.reps === undefined ? 1 : opts.reps;
        maxsecs = opts.maxsecs === undefined ? 4 : opts.maxsecs;
        minms = opts.minms === undefined ? 2 : opts.minms;

        var maxms = maxsecs * 1000;
        var overhead, oreps = reps;
        console.log("Benchmarking", reps, "with", maxsecs, "max seconds");
        var dummy = function() {}
        var now = Date.now();
        while(--oreps >= 0 && ((overhead = (Date.now() - now)) < maxms))
        {
            dummy.apply(this, prepare());
        }
        if (overhead >= maxms)
        {
            console.log("Overhead > max time, bailing.")
            return
        }
        var timed, rreps = reps;
        now = Date.now();
        while(--rreps >= 0 && ((timed = (Date.now() - now)) < maxms))
        {
            fn.apply(this, prepare());
        }
        var did = reps - rreps;
        var delta = timed - (overhead / reps * did);
        if (delta >= minms)
        {
            console.log(did, "reps in", 
                        timed, "ms with", 
                        //overhead, "ms overhead is", 
                        delta / did, "ms per rep, and",
                        1000 / (delta / did), "reps per sec");
        }

        if ((timed * 2) < maxms)
        {
            benchmark(fn, args, Object.assign({}, opts, { reps: reps * 2 }));
        }
        else
        {
            console.log("Done")
        }
    }

    //////////////////////////////////////////////////////////////////////////
    
    var debug = AQT.debug = function()
    {
        console.log.apply(console, arguments);
    }
   
    //////////////////////////////////////////////////////////////////////////
    
});

