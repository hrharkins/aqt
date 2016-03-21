// aqt/comparator.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/comparator',
['aqt#AQT'],
function(AQT)
{

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    var comparator = aqt.comparator = this.comparator = function comparator(o)
    {
        if (o instanceof Array)
        {
            var p = o.__proto__;
            var n = o.length;
            var cmps = [];

            for (var i = 0; i < n; ++i)
            {
                cmps.push(comparator(o[i]));
            }

            return function(t)
            {
                if ((t === undefined) || (t === null) || (t.__proto__ !== p))
                {
                    return true;
                }

                if (t.length !== n)
                {
                    return true;
                }

                for (var i = 0; i < n; ++i)
                {
                    if (cmps[i](t[i]) === true)
                    {
                        return true;
                    }
                }

                return false;
            }
        }
        else if (typeof o === 'object')
        {
            var p = o.__proto__;
            var cmps = {};
            for (var key in o)
            {
                if (! Object.hasOwnProperty(o, key))
                {
                    cmps[key] = comparator(o[key]);
                }
            }
            var nkeys = keys.length;

            return function(t)
            {
                if ((t === undefined) || (t === null) || (t.__proto__ !== p))
                {
                    return true;
                }

                for (var k in cmps)
                {
                    if (cmps[k](t[k]) === true)
                    {
                        return true;
                    }
                }

                for (var k in t)
                {
                    if (! Object.hasOwnProperty(t, k) && ! ( k in cmps))
                    {
                        return true;
                    }
                }

                return false;
            }
        }
        else if (typeof o === 'function')
        {
            return o;
        }
        else if (o === null)
        {
            return function(t) { return t === undefined || t === null; }
        }
        else 
        {
            return function(t) { return o !== t; }
        }
    }
    
});

