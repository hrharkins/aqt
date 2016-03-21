// aqt/core.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/context',
['aqt#AQT', 'aqt#Class', 'aqt://aqt/core/variable#Variable'],
function(AQT, Class, Variable)
{

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var context = AQT.context = this.context = function(base)
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

    var Context = AQT.Context = this.Context = new Class
    (
        function Context()
        {
            this.$root = this.$context = this;
        },

        function $(path)
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

        function $new()
        {
            return context(this);
        },

        // Delegate key methods of refs to the default ref. 
        function $in()
        { var r = this.$(); return r.$in.apply(r, arguments); },
        function $get()
        { var r = this.$(); return r.$get.apply(r, arguments); },
        function $set()
        { var r = this.$(); return r.$set.apply(r, arguments); },
        function $call()
        { var r = this.$(); return r.$call.apply(r, arguments); },
        function $$call()
        { var r = this.$(); return r.$$call.apply(r, arguments); },
        function $apply()
        { var r = this.$(); return r.$apply.apply(r, arguments); },
        function $$apply()
        { var r = this.$(); return r.$$apply.apply(r, arguments); },
        function $define()
        { var r = this.$(); return r.$define.apply(r, arguments); },
        function $make()
        { var r = this.$(); return r.$make.apply(r, arguments); },
        function $refresh()
        { var r = this.$(); return r.$refresh.apply(r, arguments); },
        function $var()
        { var r = this.$(); return r.$var.apply(r, arguments); },
        function $$var()
        { var r = this.$(); return r.$$var.apply(r, arguments); },

        {
            ':int': parseInt,
            ':bool': function(v) { return !!v; }
        }
    );

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

    var Ref = AQT.Ref = this.Ref = new Class
    (
        function Ref(ctx, path)
        {
            this.ctx = ctx;
            this.path = path;
        },

        function $(subpath)
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

        function $new()
        {
            return this.$in(this.ctx.$new());
        },

        function $get(subpath)
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

        function $set(subpath, value)
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

        function $var(value, self)
        {
            this.ctx[this.path] = new Variable(value, self).fn;
            return this;
        },

        function $$var(subpath, value, self)
        {
            return this.$(subpath).$var(value, self);
        },

        function $call()
        {
            return this._.apply(this, arguments);
        },

        function $$call(what)
        {
            var args = Array.prototype.slice.call(arguments, 1);
            return this.$(what)._.apply(this, args);
        },

        function $apply(args)
        {
            return this._.apply(this, args);
        },

        function $$apply(what, args)
        {
            return this.$(what)._.apply(this, args);
        },

        function $define(obj)
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
        
        function $in(ctx)
        {
            return ctx === this.ctx ? this : new Ref(ctx, this.path);
        },

        function $make(what, config, refresh)
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
                resolution = meta[what] = new aqt.Promise();
                var value = fn.call(this, this._, config, resolution);
                if (value !== undefined)
                {
                    resolution.$deliver(value);
                }
            }
            return resolution;
        },

        function $refresh(what)
        {
            return this.$make(what, undefined, true);
        },

        function $morph()
        {
            var ref = this;
            return this.$make.apply(this, arguments).$then(
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

        function $declare(maker, fn)
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

        function $then()
        {
            var v = this._.$promise;
            return v.then.apply(this, arguments);
        },

        function $defined()
        {
            var v = this._.$promise;
            return v.defined.apply(this, arguments);
        },

        function $next()
        {
            var v = this._.$promise;
            return v.next.apply(this, arguments);
        }
    );

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


});

