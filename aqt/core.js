// aqt/core.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

window.aqt = window.aqt || (function()
{
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var argslice = Array.prototype.slice

    function aqt()
    {
        return aqt.lookup.apply(this, arguments);
    }

    var AQT = aqt.__proto__ = Object.create(Function.prototype);

    (function()
    {
        var scripts = document.scripts;
        var script = scripts[scripts.length - 1];
        var src = AQT.href = script.src;
        AQT.lib = src.substring(0, src.lastIndexOf('/') + 1);
    })();

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
 
    var Class = AQT.Class = function Class()
    {
        var i = 0;
        var name, constructor;
        var proto = this.$proto = Object.create(this.$proto || null);

        if (typeof arguments[i] === 'string')
        {
            name = arguments[i++];
        }
        if (typeof arguments[i] === 'function')
        {
            constructor = arguments[i++];
            if (name === undefined)
            {
                name = constructor.name;
            }
        }
        var factory = eval(
        [
            '(function ' + (name || '') + '()',
            '{',
            '   constructor.apply(this, arguments);',
            '})'
        ].join('\n'));
        factory.__proto__ = this;
        factory.prototype = proto;
        for (; i < arguments.length; ++i)
        {
            var arg = arguments[i];
            switch(typeof arg)
            {
                case 'object':
                    Object.assign(proto, arg);
                    break;
                case 'function':
                    proto[arg.name] = arg;
                    break;
                default:
                    throw "Unsupport class declaration " + arg;
            }
        }

        if (constructor === undefined)
        {
            constructor = function() {};
        }

        factory.$name = name;
        return factory;
    };

    Class.prototype = Object.assign(Object.create(Function),
    {
        $extend: function()
        {
            var obj = Object.create(this);
            return Class.apply(obj, arguments);
        },
        $classmethod: function()
        {
            _class_define(this, arguments);
            return this;
        },
        $method: function()
        {
            _class_define(this.$proto, arguments);
            return this;
        }
    });

    function _class_define(dest, args)
    {
        var i = 0, name, fn;
        if (typeof args[i] === 'string')
        {
            name = args[i++];
        }
        if (typeof args[i] === 'function')
        {
            fn = args[i++];
            if (name === undefined)
            {
                name = fn.name;
            }
        }
        if (fn === undefined)
        {
            throw "Function is required for method";
        }
        if (! name)
        {
            throw "Name is required for method";
        }
        dest[name] = fn;
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
  
    var isArrayish = AQT.isArrayish = function isArrayish(obj)
    {
        return obj instanceof Array || 
                (typeof obj === 'object' && obj.length !== undefined);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    var URL_RE = new RegExp(
    [
        '^',
        '(?:([^:]*):)?',            // Protocol
        '(?://([^/]*))?',           // "Netloc"
        '([^?#]*)',                 // Path
        '(?:\\?([^\#]*))?',         // Query
        '(?:\#(.*))?',              // Fragment
        '$'
    ].join(''));
    var URI = AQT.URI = Class
    (
        function URI(src)
        {
            if (typeof src === 'string')
            {
                var m = src.match(URL_RE);
                if (m === undefined)
                {
                    throw "Invalid URI: " + src;
                }
                this.href = m[0];
                if (m[1] !== undefined)
                {
                    this.scheme = m[1];
                }
                if (m[2] !== undefined)
                {
                    this.netloc = m[2];
                }
                if (m[3])
                {
                    this.pathname = m[3];
                }
                if (m[4] !== undefined)
                {
                    this.search = m[4];
                }
                if (m[5] !== undefined)
                {
                    this.hash = m[5];
                }
            }
            else if (src instanceof URI)
            {
                return src;
            }
            else if (typeof src === 'object')
            {
                Object.assign(this, src);
            }
        },

        function $deref(base, relpath)
        {
            var uri = new URI(this);
            if (this.scheme === 'aqt')
            {
                var ref = window[this.netloc];
                if (ref === undefined || ref.rel !== 'aqt')
                {
                    throw 'Invalid ref for AQT URL: ' + this.href;
                }
                base = new URI(ref.href).$deref(base);
                uri.netloc = undefined;
                uri.scheme = undefined;
                relpath = true;
            }
            else
            {
                base = base === undefined ? pageURI : new URI(base).$deref();
            }
            if (uri.scheme === undefined)
            {
                uri.scheme = base.scheme;
            }
            if (uri.netloc === undefined)
            {
                uri.netloc = base.netloc;
            }
            if (uri.pathname === undefined)
            {
                uri.pathname = base.pathname;
                if (uri.search === undefined)
                {
                    uri.search = base.search;
                    if (uri.hash === undefined)
                    {
                        uri.hash = base.hash;
                    }
                }
            }
            else if (relpath && base.pathname !== undefined)
            {
                var path = base.pathname;
                path = path.substring(0, path.lastIndexOf('/'));
                uri.pathname = path + uri.pathname;
            }
            uri.href = uri.$href();
            return uri;
        },

        function $href()
        {
            return (
                (this.scheme ? this.scheme + '://': '') +
                (this.netloc ? (this.scheme ? '' : '') + this.netloc : '') +
                (this.pathname ? this.pathname : '') +
                (this.search ? '?' + this.search : '') +
                (this.hash ? '#' + this.hash : '')
            );
        }
    );

    var pageURI = AQT.uri = new URI(window.location.href);
    var aqturi = AQT.aqturi = new URI(aqt.href);

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var Pipeline = AQT.Pipeline = new Class
    (
        function Pipeline(self)
        {
            this.$self = self === undefined ? this : self;
            this.$$chain = [];
        },

        function $distribute(obj, callback, initiator)
        {
            var chain = this.$$chain;
            var l = this.count;
            if (l !== 0)
            {
                distribute.call(this.$self, obj, chain, 0, l,
                                callback, initiator);
            }
            return this;
        },

        function $call()
        {
            return this.$deliver(arguments);
        },

        function $deliver()
        {
            return this.$distribute.apply(this, arguments);
        },

        function $then()
        {
            var nargs = arguments.length;
            var l = this.count;
            var chain = this.$$chain;
            if (l + nargs >= chain.length)
            {
                chain.length = chain.length * 2 + 4;
            }
            for (i = 0; i < nargs; ++i)
            {
                chain[l++] = arguments[i];
            }
            this.count = l;
            return this;
        },

        function $fn(fn)
        {
            return this.$then(
            function(data)
            {
                if (data instanceof Array)
                {
                    return fn.apply(this, data);
                }
                else
                {
                    return fn.call(this, data);
                }
            });
        },

        function $when(obj)
        {
            watch.call(this, obj, this.$deliver, true);
            return this;
        },

        function $watch(obj)
        {
            watch.call(this, obj, this.$watch_deliver);
            return this;
        },

        function $watch_deliver(obj)
        {
            this.$deliver(obj);
        },

        { count: 0 }
    );

    //////////////////////////////////////////////////////////////////////////
    
    var watch = AQT.watch = function watch(obj, callback, once)
    {
        var self = this;

        // Avoids immediate firing.
        var waiting = 1;

        function await(src, base, key, triggerfn)
        {
            ++waiting;
            var unset = true;
            base[key] = undefined;
            src.$then(function(value)
            {
                base[key] = value;
                if (waiting === 0)
                {
                    trigger(src, base, key);
                }
                else if (unset)
                {
                    unset = false;
                    if (--waiting === 0)
                    {
                        trigger();
                    }
                }
            })
        }

        function prepare(obj, base, key)
        {
            if (obj === undefined)
            {
                return;
            }
            else if (isArrayish(obj))
            {
                var n = obj.length;
                for (var i = 0; i < n; ++i)
                {
                    prepare(obj[i], obj, i);
                }
            }
            else if (obj.$deliver !== undefined)
            {
                await(obj, base, key);
            }
            else
            {
                var deliver = obj.$deliver;
                if (deliver === undefined)
                {
                    for (var key in obj)
                    {
                        if (! Object.prototype.hasOwnProperty(obj, key))
                        {
                            prepare(obj[key], obj, key);
                        }
                    }
                }
                else
                {
                    await(obj, base, key);
                }
            }
        }

        function trigger(src, base, key)
        {
            if (src === undefined)
            {
                if (callback.call(self, obj) === true)
                {
                    cancel();
                }
            }
            else
            {
                if (callback.call(self, obj, src, base, key) === true)
                {
                    cancel();
                }
            }
            if (once)
            {
                cancel();
            }
        }

        function cancel()
        {
        }

        prepare(obj, arguments, 0);
        if (--waiting === 0)
        {
            trigger();
        }

        return obj;
    }

    //////////////////////////////////////////////////////////////////////////

    var distribute = AQT.distribute =
    function distribute(data, chain, start, end, callback, initiator)
    {
        if (end === undefined)
        {
            end = chain.$count;
            if (end === undefined)
            {
                end = chain.length;
            }
        }

        if (start === undefined)
        {
            start = 0;
        }

        if (initiator === undefined)
        {
            initiator = this;
        }

        for (var i = start; i < end; ++i)
        {
            var link = chain[i];
            if (link !== undefined)
            {
                var distribute = link.$distribute;
                if (typeof distribute === 'function'
                    || typeof link === 'function')
                {
                    var result = distribute === undefined
                                 ? link.call(this, data, callback, initiator)
                                 : distribute.call(link, data, 
                                                   callback, initiator);

                    if (result !== undefined)
                    {
                        if (result === true)
                        {
                            break;
                        }
                        if (typeof result === 'function')
                        {
                            result(function()
                            {
                                distribute(data, chain, i, end,
                                           callback, initiator);
                            });
                            return this;
                        }
                        else
                        {
                            result.then(function()
                            {
                                distribute(data, chain, i, end,
                                           callback, initiator);
                            });
                            return this;
                        }
                    }
                }
            }
        }

        if (callback !== undefined)
        {
            var deliver = callback.$deliver;
            if (deliver !== undefined)
            {
                deliver.call(callback, data, this, initiator);
            }
            else
            {
                callback.call(this, data, this, initiator);
            }
        }

        return this;
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var Promise = AQT.Promise = Pipeline.$extend
    (
        function Promise()
        {
            Pipeline.apply(this, arguments);
        },

        function $distribute(data)
        {
            this.$resolve(data);
            Pipeline.prototype.$distribute.apply(this, arguments);
        },

        function $resolve(data)
        {
            this.$distribute = this.$resolved_distribute; 
            this.$then = this.$resolved_then;
            this.$data = data;
            return this;
        },

        function $resolved_distribute()
        {
            throw "Cannot deliver to a resolved promise"
        },

        function $resolved_then()
        {
            distribute.call(this.$self, this.$data, arguments);
            return this;
        }
    );

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
 
    var Singleton = AQT.Singleton = Promise.$extend
    (
        function Singleton()
        {
            Promise.apply(this, arguments);
        },

        function $resolved_distribute() { }
    );

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
  
    var ready = AQT.ready = new Promise();

    document.addEventListener('DOMContentLoaded', 
                              function() { ready.$deliver(aqt); });

    ready.$then(
    function(aqt)
    {
        aqt.module('aqt',
        function()
        {
            Object.assign(this, aqt);
        });
    });

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
   
    var loaders = {};
    var loader = AQT.loader = function loader(uri)
    {
        uri = new URI(uri);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
   
    var modules = {};
    var Module = AQT.Module = Singleton.$extend
    (
        function Module(id)
        {
            Singleton.call(this);
            this.$id = id;
            this.$deps = {};
        },

        function $load()
        {
            var loaded = this.$loaded;
            if (loaded === undefined)
            {
                var loader = this.$loader;
                if (loader === undefined)
                {
                    throw 'No loader defined for ' + this.$id;
                }
                loaded = this.$loaded = new aqt.Promise();
                loader(loaded);
            }
            return this;
        }
    )
    .$classmethod(
    function locate(uri, deps, fn)
    {
        var module = modules[uri];
        if (module === undefined)
        {
            module = modules[uri] = new Module(uri);
        }
        if (fn === undefined)
        {
            fn = deps; deps = undefined;
        }
        if (typeof fn === 'function')
        {
            var config = new Promise(module);
            deps = deps === undefined ? [] 
                    : ! (deps instanceof Array) ? [deps] : deps;
            var ndeps = deps.length;
            for (var i = 0; i < ndeps; ++i)
            {
                var base = deps[i];
                if (typeof base === 'string')
                {
                    var fragidx = base.indexOf('#');
                    if (fragidx < 0)
                    {
                        deps[i] = module.$deps[base] = aqt.module(base);
                    }
                    else
                    {
                        var fragment = base.substring(fragidx + 1);
                        base = base.substr(0, 
                                base.length - fragment.length - 1);
                        var req = aqt.module(base);
                        var result = new aqt.Promise();
                        req.$then(function() 
                        {
                            var obj = req[fragment];
                            result.$deliver(obj);
                            module.$deps[base] = obj;
                        });
                        deps[i] = result;
                    }
                }
            }
            config.$when(deps)
                  .$fn(fn)
                  .$then(function() { module.$deliver(module); });
            this.$loader = function(loaded) { loaded.$deliver(); };
        }
        else if (typeof fn === 'string')
        {
            var src = new URI(fn);
            module.$loader = function(loaded)
            {
                var script = document.createElement('script');
                script.src = src.$deref().href;
                script.onload = function() 
                { 
                    loaded.$deliver(); 
                };
                document.body.appendChild(script);
            }
        }
        return module;

    });

    var module = AQT.module = Module.locate;

    module('aqt', function()
    {
        Object.assign(this, aqt, AQT);
        this.AQT = AQT;
    });

    ready.$then(
    function()
    {
        if (window['aqt-lib'] === undefined)
        {
            var link = document.createElement('link');
            link.id = 'aqt-lib';
            link.href = aqt.lib;
            link.type = 'aqt';
            link.rel = 'aqt';
            document.head.appendChild(link);
        }

        var links = document.querySelectorAll('link');
        var nlinks = links.length;
        for (var i = 0; i < nlinks; ++i)
        {
            var link = links[i];
            if (link.rel === 'aqt' && link.type === 'aqt/module')
            {
                var mod = module(link.id, link.href);
                var name = link.getAttribute('name');
                if (name !== undefined)
                {
                    modules[name] = mod;
                }
            }
        }

        aqt.module('aqt://aqt/core/dom', 
                   'aqt://aqt-lib/core/dom.js').$load();
        aqt.module('aqt://aqt/core/context', 
                   'aqt://aqt-lib/core/context.js').$load();
        aqt.module('aqt://aqt/core/variable', 
                   'aqt://aqt-lib/core/variable.js').$load();
        aqt.module('aqt://aqt/core/comparator', 
                   'aqt://aqt-lib/core/comparator.js').$load();
        aqt.module('aqt://aqt/xtra/request', 'aqt://aqt-lib/xtra/request.js');
        aqt.module('aqt://aqt/xtra/debug', 'aqt://aqt-lib/xtra/debug.js');
    });

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    return aqt
    
})();

