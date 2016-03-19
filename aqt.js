// aqt.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

var aqt = window.aqt || (function()
{
    var argslice = Array.prototype.slice

    function aqt(obj, into)
    {
        if (obj instanceof Element)
        {
            var ctx = obj.aqt;
            return ctx === undefined ? aqt(obj.parentElement) : ctx;
        }
        else if (obj === undefined || obj === null)
        {
            return null;
        }
        else if (typeof obj === 'string')
        {
            var base = this === window ? document : this;
            var elements = base.querySelectorAll(obj);
            var n = elements.length;
            var result = into;
            for (var i = 0; i < n; ++i)
            {
                var ctx = aqt(elements[i]);
                result = result === undefined ? ctx : result;
            }
            return result;
        }
    }

    var AQT = aqt.__proto__ = Object.create(Function.prototype);

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    var Promise = AQT.Promise = function Promise(self)
    {
        if (self !== undefined)
        {
            this.self = self;
        }
    };

    Promise.prototype = 
    {
        nextLinkID: 0,

        $accept: function()
        {
            return this.$deliver.apply(this, arguments);
        },

        $deliver: function(data, callback, start, initiator)
        {
            var self = this.self;
            self = self === undefined ? this : self;
            initiator = initiator === undefined ? this : initiator;
            var chain = this.$$chain;
            if (chain !== undefined)
            {
                var l = chain.l;
                for (var i = start === undefined ? 0 : start; i < l; ++i)
                {
                    var link = chain[i];
                    // TODO: May not need this.  Not sure how to dsiable
                    // yet.
                    var resolution = (typeof link === 'function')
                                     ? link.call(self, data, initiator, this)
                                     : undefined;
                    if (resolution !== undefined)
                    {
                        var promise = this;
                        resolution.then(function(replace)
                        {
                            promise.deliver(replace === undefined 
                                                ? data : replace,
                                            callback, i + 1, initiator);
                        });
                        return callback;
                    };
                }
            }

            if (callback !== undefined)
            {
                callback.call(self, data, initiator, this); 
            }
        },

        $when: function(obj, single)
        {
            var waiting = 1;        // Prevents immediate triggers.
            var promise = this;
            var cancels = single ? [] : undefined;

            if (typeof obj === 'function')
            {
                obj = obj(this);
            }

            function await(source, base, key)
            {
                ++waiting;
                var unset = true;
                base[key] = undefined;
                var id = source.$add(function(value)
                {
                    base[key] = value;
                    if (waiting === 0)
                    {
                        promise.$accept(obj);
                    }
                    else if (unset && --waiting === 0)
                    {
                        unset = false;
                        if (single)
                        {
                            var n = cancels.length;
                            for (var i = 0; i < n; i += 2)
                            {
                                cancels[i].$cancel(cancels[i+1]);
                            }
                        }
                        promise.$accept(obj);
                    }
                });

                if (single)
                {
                    cancels.push(source, id);
                }
            }

            function prepare(obj, base, key)
            {
                if (obj === undefined)
                {
                    return;
                }
                else if (obj instanceof Array)
                {
                    var n = obj.length;
                    for (var i = 0; i < n; ++i)
                    {
                        prepare(obj[i], obj, i);
                    }
                }
                else if (obj.$promise)
                {
                    await(obj.$promise, base, key);
                }
                else if (obj instanceof Promise)
                {
                    await(obj, base, key);
                }
                else
                {
                    for (var key in obj)
                    {
                        prepare(obj[key], obj, key);
                    }
                }
            }

            prepare(obj, arguments, 0);

            if (! --waiting)
            {
                this.$accept(obj);
            }
            
            return this;
        },

        $every: function()
        {
            return this.$when(arguments, false);
        },

        $once: function()
        {
            return this.$when(arguments, true);
        },

        $add: function()
        {
            var chain = this.$$chain;
            var idx = chain === undefined ? 0 : chain.l;

            if (chain !== undefined 
                && chain.length < chain.l + arguments.length + 1)
            {
                chain[chain.length * 2 + 1] = undefined;
            }

            this.$then.apply(this, arguments);

            var id = '@' + this.nextLinkID++;
            var chain = this.$$chain;
            chain[chain.l] = id;
            chain[chain.l+1] = chain.l - idx + 2;
            chain.l += 2;
            return id;
        },

        $cancel: function(id)
        {
            var chain = this.$$chain;
            if (chain !== undefined)
            {
                var l = chain.l;
                for (var end = 0; end < l; ++end)
                {
                    if (chain[end] === id)
                    {
                        var size = chain[++end];
                        var start = ++end - size;
                        for (var i = start; i < end; ++i)
                        {
                            chain[i] = chain[i + size];
                        }
                        chain.l -= size;
                        return;
                    }
                }
            }
        },

        $then: function()
        {
            var l = arguments.length;
            var start = 0;
            var promise = this;
            if (l === 0)
            {
                return this;
            }
            var status = arguments[0];
            if (typeof status === 'string')
            {
                var promise = this[status];
                start = 1;
            }

            var chain = this.$$chain;
            if (chain === undefined)
            {
                // Pre-allocate space.
                chain = this.$$chain = new Array(l + 3);
                chain.l = 0;
            }
            else if (chain.length < chain.l + l - 1)
            {
                chain[chain.length * 2 - 1] = undefined;
            }
            if (l === 1)
            {
                chain[chain.l] = arguments[0];
            }
            else
            {
                var j = chain.l;
                for (var i = 0; i < l; ++i)
                {
                    chain[++j] = arguments[i];
                }
            }
            chain.l += l;

            return this;
        },

        $call: function(fn)
        {
            return this.$then(function(args) { return fn.apply(this, args) });
        },

        $addcall: function(fn)
        {
            return this.$add(function(args) { return fn.apply(this, args) });
        },

        $with: function(status, fn)
        {
            this[status] = fn === undefined ? new Resolution(this.self) : fn;
            return this;
        },

        ':int': parseInt
    };

    Object.defineProperty(
        Promise.prototype, '$chain',
        {
            get: function()
            {
                var fn = this.$$chain;
                if (fn === undefined)
                {
                    var promise = this;
                    fn = function deliverer()
                    {
                        return promise.$accept.apply(promise, arguments);
                    };
                    Object.assign(fn, promise.$accept);
                    fn.$promise = promise;
                    this.$$chain = fn;
                }
                return fn;
            }
        }
    );

    Object.defineProperty(
        Promise.prototype, '$fn',
        {
            get: function()
            {
                var fn = this.$$fn;
                if (fn === undefined)
                {
                    var promise = this;
                    fn = function deliverer()
                    {
                        return promise.$accept.call(promise, arguments);
                    };
                    Object.assign(fn, promise.$accept);
                    fn.$promise = promise;
                    this.$$fn = fn;
                }
                return fn;
            }
        }
    );

    var delivererMethods = Promise.prototype.$delivererMethods =
    {
        $when: function() 
        { this.$promise.$when.apply(this.$promise, arguments); return this; },
        $every: function() 
        { this.$promise.$every.apply(this.$promise, arguments); return this; },
        $once: function() 
        { this.$promise.$once.apply(this.$promise, arguments); return this; },
        $add: function() 
        { return this.$promise.$add.apply(this.$promise, arguments); },
        $cancel: function() 
        { this.$promise.$cancel.apply(this.$promise, arguments); return this; },
        $then: function() 
        { this.$promise.$then.apply(this.$promise, arguments); return this; },
        $call: function() 
        { this.$promise.$call.apply(this.$promise, arguments); return this;},
        $addcall: function() 
        { return this.$promise.$addcall.apply(this.$promise, arguments); },
        $with: function() 
        { this.$promise.$with.apply(this.$promise, arguments); return this; },
        $accept: function() 
        { this.$promise.$accept.apply(this.$promise, arguments); return this; },
        $deliver: function() 
        { this.$promise.$deliver.apply(this.$promise, arguments); return this; }
    };

    Object.defineProperty(Promise.prototype, '$promise',
                          { get: function() { return this; } } );

    Object.defineProperty(delivererMethods, '$fn',
                          { get: function() { return this; } } );

    //////////////////////////////////////////////////////////////////////////
    
    var Resolution = AQT.Resolution = function Resolution(self)
    {
        Promise.apply(this, arguments);
    }

    Resolution.prototype = Object.assign(Object.create(Promise.prototype),
    {
        deliver: function(data, start)
        {
            var resolution = Promise.prototype.deliver.call(this, data, start);
            if (resolution === undefined)
            {
                this.resolve(data);
            }
            else
            {
                resolution.then(this.resolve.bind(this));
            }
            return resolution;
        },

        resolve: function(data)
        {
            var self = this.self;
            self = self === undefined ? this : self;
            this.deliver = delivered_resolution_deliverfn;
            this.then = delivered_resolution_thenfn;
            this.data = data
            delete this.$$chain;
        }
    });

    function delivered_resolution_deliverfn()
    {
        throw "Cannot deliver on resolved promise";
    };

    function delivered_resolution_thenfn(fn)
    {
        fn.call(self, this.data, this);
        return this;
    };

    //////////////////////////////////////////////////////////////////////////
    
    var Variable = AQT.Variable = function Variable(self, value)
    {
        Promise.call(this, self);
        if (value !== undefined)
        {
            this.value = value;
            this.changed = comparator(value);
        }
        return this.fn;
    }

    Variable.prototype = Object.assign(Object.create(Promise.prototype),
    {
        $deliver: function(value, callback, start, initiator)
        {
            if (this.changed !== undefined)
            {
                if (! this.changed(value))
                {
                    // No change.
                    return;
                }
            }
            this.value = value;
            this.changed = comparator(value);
            return Promise.prototype.$deliver.apply(this, arguments);
        },

        $then: function(fn)
        {
            var value = this.value;
            if (value !== undefined)
            {
                fn.call(this, value);
            }
            return Promise.prototype.$then.apply(this, arguments);
        },

        $install: function(what, config)
        {
            var promise = this[what];
            if (promise === undefined)
            {
                var self = this.self;
                self = self === undefined ? this : self;
                var fn = self[':' + what];
                if (fn === undefined)
                {
                    throw 'Cannot make ' + what;
                }
                promise = new DerivedVariable(this, undefined, this.self);
                var install = fn.$install;
                if (install !== undefined)
                {
                    install.call(promise, what, config, this);
                }
                else 
                {
                    var what = fn.$what;
                    var src = what === undefined ? this : this.$when(what);
                    src.$then(function(value)
                    {
                        var result = fn.call(value, this, config);
                        if (result !== undefined)
                        {
                            promise.$deliver(result);
                        }
                    });
                }

                if (config === undefined)
                {
                    this[what] = promise;
                }
            }
            return promise;
        },

        $service: function(what, fn)
        {
            var self = this.self;
            self = self === undefined ? this : self;
            var set = self.$set;
            if (set === undefined)
            {
                self[':' + what] = fn;
            }
            else
            {
                set.call(self, ':' + what, fn);
            }
            return this;
        }
    });

    Variable.prototype.$delivererMethods = 
    Object.assign(
    {
        $service: function() 
        { 
            this.$promise.$service.apply(this.$promise, arguments); 
            return this; 
        },
        $install: function() 
        { 
            this.$promise.$install.apply(this.$promise, arguments); 
            return this; 
        }
    }, Variable.prototype.$delivererMethods);

    DerivedVariable = function(source, self, value)
    {
        this.$source = source;
        Variable.call(this, self, value);
    }

    DerivedVariable.prototype = Object.assign(Object.create(Variable.prototype),
    {
        $assign: function()
        {
            return this.$source.$assign.apply(this.$source, arguments);
        }
    });

    //////////////////////////////////////////////////////////////////////////

    var comparator = aqt.comparator = function comparator(o)
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
    
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    var install = AQT.install = function install(target, into)
    {
        if (target instanceof Element)
        {
            var ctx = target.aqt;
            if (ctx === undefined)
            {
                target.aqt = ctx = context(aqt(target.parentElement));
                ctx.$element = target;

                var attrs = target.attributes;
                var nattrs = attrs.length;
                for (var attridx = 0; attridx < nattrs; ++attridx)
                {
                    var attr = attrs[attridx];
                    var name = attr.name;
                    if (name.substring(0, 4) === 'aqt-')
                    {
                        name = name.substring(4);
                        var parts = name.split(':');
                        var dest = ctx.$$var(parts[0]);
                        var nparts = parts.length;
                        if (nparts > 1)
                        {
                            var wip = dest.$in(ctx.$new());
                            for (var partidx = 1; partidx < nparts; ++partidx)
                            {
                                wip = wip.$morph(parts[partidx]);
                            }
                        }
                        else
                        {
                            dest(attr.value);
                        }
                    }
                }

                function updateChildrenOf(target, ctx)
                {
                    var children = target.children;
                    var n = children.length;
                    for (var i = 0; i < n; ++i)
                    {
                        var child = children[i];
                        if (child instanceof Element)
                        {
                            var childctx = child.aqt;
                            if (childctx !== undefined)
                            {
                                childctx.__proto__ = childctx.$parent = ctx;
                            }
                            updateChildrenOf(child, ctx);
                        }
                    }
                }

                updateChildrenOf(target, ctx);
            }
            return ctx;
        }
        else if (typeof target === 'string')
        {
            var base = this === aqt ? document : this;
            var elements = base.querySelectorAll(target);
            var n = elements.length;
            var result = into;
            for (var i = 0; i < n; ++i)
            {
                var ctx = install(elements[i]);
                result = result === undefined ? ctx : result;
            }
            return result;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var Context = AQT.Context = function AQTContext()
    {
        this.$root = this.$context = this;
    };

    var context = AQT.context = function(base)
    {
        if (base == null)
        {
            return new Context();
        }
        else
        {
            var ctx = Object.create(base);
            ctx.$context = ctx;
            return ctx;
        }
    }

    Context.prototype =
    {
        $: function(path)
        {
            if (path)
            {
                return new Ref(this, path[0] === '-' ? path : '-' + path);
            }
            else
            {
                return new Ref(this, '');
            }
        },

        $new: function()
        {
            return context(this);
        },

        // Delegate key methods of refs to the default ref. 
        $in: function()
        { var r = this.$(); return r.$in.apply(r, arguments); },
        $get: function()
        { var r = this.$(); return r.$get.apply(r, arguments); },
        $set: function()
        { var r = this.$(); return r.$set.apply(r, arguments); },
        $call: function()
        { var r = this.$(); return r.$call.apply(r, arguments); },
        $$call: function()
        { var r = this.$(); return r.$$call.apply(r, arguments); },
        $apply: function()
        { var r = this.$(); return r.$apply.apply(r, arguments); },
        $$apply: function()
        { var r = this.$(); return r.$$apply.apply(r, arguments); },
        $define: function()
        { var r = this.$(); return r.$define.apply(r, arguments); },
        $make: function()
        { var r = this.$(); return r.$make.apply(r, arguments); },
        $refresh: function()
        { var r = this.$(); return r.$refresh.apply(r, arguments); },
        $var: function()
        { var r = this.$(); return r.$var.apply(r, arguments); },
        $$var: function()
        { var r = this.$(); return r.$$var.apply(r, arguments); },

        ':int': parseInt,
        ':bool': function(v) { return !!v; }
    };

    Object.defineProperty(Context.prototype, '_',
    {
        get: function() { return this.$()._; },
        set: function(value) { return this.$()._ = value; },
    });

    Object.defineProperty(Context.prototype, '$make',
    {
        get: function() { return this.$().$meta; }
    });

    Object.defineProperty(Context.prototype, '$parent',
    {
        get: function() { return this.$context.__proto__.$context; },
    });

    //////////////////////////////////////////////////////////////////////////

    var Ref = AQT.Ref = function Ref(ctx, path)
    {
        this.ctx = ctx;
        this.path = path;
    }

    Ref.prototype =
    {
        $: function(subpath)
        {
            if (subpath)
            {
                return new Ref(this.ctx, subpath[0] == '-' 
                               ? subpath 
                               : this.path + '-' + subpath);
            }
            else
            {
                return this;
            }
        },

        $new: function()
        {
            return this.$in(this.ctx.$new());
        },

        $get: function(subpath)
        {
            if (arguments.length == 0)
            {
                return this.ctx[this.path];
            }
            else
            {
                return this.ctx[this.path + subpath];
            }
        },

        $set: function(subpath, value)
        {
            var path = arguments.length === 1 ? this.path : this.path + subpath;
            var ctx = this.ctx;
            if (arguments.length === 1)
            {
                value = subpath;
            }
            if (ctx[path] !== value)
            {
                ctx[path] = value;
                ctx['-' + path] = undefined;
            }
            return this;
        },

        $var: function(value, self)
        {
            this.ctx[this.path] = new Variable(value, self).fn;
            return this;
        },

        $$var: function(subpath, value, self)
        {
            return this.$(subpath).$var(value, self);
        },

        $call: function()
        {
            return this._.apply(this, arguments);
        },

        $$call: function(what)
        {
            var args = Array.prototype.slice.call(arguments, 1);
            return this.$(what)._.apply(this, args);
        },

        $apply: function(args)
        {
            return this._.apply(this, args);
        },

        $$apply: function(what, args)
        {
            return this.$(what)._.apply(this, args);
        },

        $define: function(obj)
        {
            if (typeof obj === 'function')
            {
                return this.$set(obj.name, obj);
            }
            else
            {
                throw "Cannot $define a " + obj.__proto__.constructor.name;
            }
        },
        
        $in: function(ctx)
        {
            return ctx === this.ctx ? this : new Ref(ctx, this.path);
        },

        $make: function(what, config, refresh)
        {
            var meta = this.$meta;
            if (config === undefined)
            {
                if (what in meta && meta[what] === undefined)
                {
                    throw '$make loop detected: ' + what;
                }
                meta[what] = undefined;
            }
            var resolution = meta[what];
            if (resolution === undefined || config !== undefined || refresh)
            {
                var fn = this.ctx[':' + what];
                if (fn === undefined)
                {
                    throw "Cannot $make " + what;
                }
                resolution = meta[what] = new aqt.Resolution();
                var value = fn.call(this, this._, config, resolution);
                if (value !== undefined)
                {
                    resolution.deliver(value);
                }
            }
            return resolution;
        },

        $refresh: function(what)
        {
            return this.$make(what, undefined, true);
        },

        $morph: function()
        {
            var ref = this;
            return this.$make.apply(this, arguments).then(
            function(value)
            {
                var meta = ref.$meta;
                var old = ref._;
                if (! ('_' in meta))
                {
                    meta._ = old;
                }
                meta.__ = old;
                ref.ctx[ref.$path] = value;
            });
        },

        $declare: function(maker, fn)
        {
            if (arguments.length === 1)
            {
                this.ctx[':' + maker.name] = maker;
            }
            else
            {
                this.ctx[':' + maker] = fn;
            }
            return this;
        },

        $then: function()
        {
            var v = this._.$promise;
            return v.then.apply(this, arguments);
        },

        $defined: function()
        {
            var v = this._.$promise;
            return v.defined.apply(this, arguments);
        },

        $next: function()
        {
            var v = this._.$promise;
            return v.next.apply(this, arguments);
        }
    };

    Object.defineProperty(Ref.prototype, '_',
                          { 
                            get: function() { return this.$get(); },
                            set: function(value) { return this.$set(value); } 
                          });

    Object.defineProperty(Ref.prototype, '$meta',
        {
            get: function()
            {
                var path = '-' + this.$path;
                var meta = this.ctx[path];
                if (meta === undefined)
                {
                    meta = this.ctx[path] = {};
                }
                return meta;
            }
        });

//    var root = new Context();
//    root.$define('$transform/');

    //////////////////////////////////////////////////////////////////////////
   
    var when = AQT.when = function when()
    {
        var l = arguments.length;
        var resolution = new aqt.Resolution();
        var args = [];
        var needed = 1;     // Fakes out immeidate triggers.
        function waiter(promise)
        {
            var i = args.length;
            var waiting = true;
            args.push(undefined);
            needed++;
            promise.then(function(value)
            {
                args[i] = value;
                if ((waiting ? --needed : needed) == 0)
                {
                    resolution.deliver(args);
                }
                waiting = false;
            });
        };
        for (var i = 0; i < l; ++i)
        {
            var arg = arguments[i];
            if (arg instanceof Array)
            {
                for (var ai = 0; ai < al; ++ai)
                {
                    waiter(arg[ai]);
                }
            }
            else if (typeof arg === 'function')
            {
                if (arg.$promise === undefined)
                {
                    arg.call(this);
                }
                else
                {
                    waiter(arg.$promise);
                }
            }
            else
            {
                waiter(arg);
            }
        }
        --needed;           // Reset for ready to fire.
        return resolution;
    }
    
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    Context.prototype[':url'] = function(src)
    {
        if (typeof src === 'string')
        {
            return src;
        }
    };

    Context.prototype[':xhr'] = function(obj, config, resolution)
    {
        when(this.$make('url'))
        .call(function(url)
        {
            resolution.deliver(new Request(url));
        });
    };

    Context.prototype[':xhr.opened'] = function(obj, config, resolution)
    {
        when(this.$make('xhr'))
        .call(function(request)
        {
            request.open();
            resolution.deliver(request);
        })
    };

    Context.prototype[':xhr.content'] = function(obj, config, resolution)
    {
        when(this.$make('xhr.opened'))
        .call(function(request)
        {
            request.success.then(resolution.fn);
            request.error.then(aqt.debug);
        });
    };

    Context.prototype[':url.parsed'] = function(src)
    {
    };

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
  
    var Request = AQT.Request = function Request(options)
    {
        var xhr = this.xhr = new XMLHttpRequest();
        Promise.call(this, xhr);
        if (typeof options === 'string')
        {
            this.url = options;
        }
        else if (typeof options === 'object')
        {
            Object.assign(this, options);
        }

        this.headers = Object.assign({}, this.headers);
        xhr.onreadystatechange = this.fn;
        this.with('success')
            .with('error')
            .with('opened')
            .with('headers')
            .with('loading')
            .with('complete')
            .then(function(event, promise)
            {
                switch(this.readyState)
                {
                    case 1: return promise.opened.deliver();
                    case 2: return promise.headers.deliver();
                    case 3: return promise.loading.deliver(this.responseText);
                    case 4: 
                        promise.complete.deliver(this.responseText,
                        function(data)
                        {
                            return this.status < 400 
                                   ? promise.success.deliver(data)
                                   : promise.error.deliver(data);
                        });
                        break;
                }
            });
    }

    Request.prototype = Object.assign(Object.create(Promise.prototype),
    {
        method: 'get',
        open:
        function(data)
        {
            var url = this.url, method = this.method;

            if (! method)
            {
                throw 'A method must be specified.';
            }

            if (! url)
            {
                throw 'A URL must be specified.';
            }

            this.xhr.open(method, url, true, this.username, this.password);
            this.xhr.send(data);
            return this;
        }
    });

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    return aqt
})()

