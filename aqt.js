
var aqt = window.aqt || (function()
{
    var argslice = Array.prototype.slice

    function aqt(obj, into)
    {
        if (obj instanceof Element)
        {
            var ctxid
            while (obj !== null && ! (ctxid = obj.getAttribute('aqt')))
            {
                obj = obj.parentElement;
            }
            if (obj === null)
            {
                return into;
            }
            else if (into === undefined)
            {
                return contexts[ctxid];
            }
            else
            {
                var context = contexts[ctxid];
                if (context !== undefined)
                {
                    into.push(contexts[ctxid]);
                }
                return into;
            }
        }
        else if (typeof obj === 'string')
        {
            var element = this === window ? document : this;
            if (into === undefined)
            {
                return aqt(element.querySelector(obj))
            }
            else
            {
                var nodes = element.querySelectorAll(obj);
                var l = nodes.length;
                for (var i = 0; i < l; ++i)
                {
                    aqt(nodes[i], into);
                }
                return into;
            }
        }
    }

    var AQT = aqt.__proto__ = new Object(Function.prototype);

    //////////////////////////////////////////////////////////////////////////
    
    var install = AQT.install = function install(target, into)
    {
        if (target instanceof Element)
        {
            var ctxid = target.getAttribute('aqt');
            if (! ctxid)
            {
                var base = aqt(target.parentNode);
                var ctxid = nextContextID++;
                var ctx = context(base).$private();
                ctx.$element = target;
                var remap = target.querySelectorAll('[aqt~="."]');

                var attrs = target.attributes;
                var attrn = attrs.length;
                for (var i = 0; i < attrn; ++i)
                {
                    var attr = attrs[i];
                    if (attr.name.substring(0, 4) == 'aqt-')
                    {
                        var parts = attr.name.substring(4).split(':');
                        var name = parts.shift();
                        var dest = ctx.$path(name);
                        ctx[name] = dest;
                        dest.$set(attr.value);
                        var xformid;
                        while ((xformid = parts.shift()) !== undefined)
                        {
                            dest.$make(xformid);
                        }
                    }
                    else if (attr.name == 'aqt:')
                    {
                        var fn = ctx.$expr(attr.value);
                        target.innerHTML = fn();
                    }
                }

                function fixup(node)
                {
                    var children = node.children;
                    var l = children.length;
                    for (var i = 0; i < l; ++i)
                    {
                        var child = children[i];
                        var ctxid;
                        if (child instanceof Element
                            && (ctxid = child.getAttribute('aqt')))
                        {
                            contexts[ctxid].__proto__ = ctx;
                        }
                        else
                        {
                            fixup(child);
                        }
                    }
                };
                fixup(target);
                target.setAttribute('aqt', ctxid);
                contexts[ctxid] = ctx;
                ctx.$id = ctxid;
                
                if (into === undefined)
                {
                    return ctx;
                }
                else
                {
                    into.push(ctx);
                    return into;
                }
            }
            else if (into === undefined)
            {
                return contexts[ctxid];
            }
            else
            {
                into.push(contexts[ctxid]);
                return into;
            }
        }
        else
        {
            var element = this === aqt ? document : this;
            var last;
            if (element.getAttribute !== undefined
                && element.getAttribute('aqt') !== null)
            {
                last = install.call(this, element, into);
            }
            var nodes = element.querySelectorAll === undefined
                        ? [] : element.querySelectorAll(target);
            var l = nodes.length;
            for (var i = 0; i < l; ++i)
            {
                last = install.call(this, nodes[i], into);
            }
            return into === undefined ? last : into;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    
    var Promise = AQT.Promise = function AQTPromise(self)
    {
        this.chain = [];
        this.self = self;
    }

    Promise.prototype =
    {
        then: function(fn)
        {
            this.chain.push(function(r) 
            { 
                return r === undefined ? undefined : fn.apply(this, arguments);
            });
            return this;
        },

        watch: function(fn)
        {
            this.chain.push(function(r, s)
            { 
                return fn.call(this, s, r);
            });
            return this;
        },

        status: function(fn)
        {
            this.chain.push(function(r, s)
            { 
                return s === undefined ? undefined : fn.call(this, s, r);
            });
            return this;
        },

        handle: function(fn)
        {
            this.chain.push(fn)
            return this;
        },

        deliver: function(result, status, start, holdoff)
        {
            var chain = this.chain,
                self = this.self;
            
            if (self === undefined)
            {
                self = this;
            }

            for (var i = start || 0; i < chain.length; ++i)
            {
                var link = chain[i];
                var hold = link.disabled === undefined
                           ? link.call(self, result, status)
                           : undefined;
                if (hold !== undefined)
                {
                    var promise = this;
                    if (holdoff === undefined)
                    {
                        holdoff = new Promise(this.self);
                    }

                    hold.handle(
                    function(_result, status)
                    {
                        var _result = _result === undefined ? result : _result;
                        var _status = _status === undefined ? status : _status;
                        return promise.deliver(_result, _status,
                                               i + 1, holdoff);
                    })

                    return holdoff;
                }
            }

            if (holdoff !== undefined)
            {
                holdoff.deliver(result, status);
            }

            if (result !== undefined)
            {
                chain = [];
                this.deliver = function()
                {
                    throw "Cannot deliver on resolved promise.";
                }
                this.then = this.handle = function(fn)
                {
                    fn.apply(self, result, status);
                }
                this.notify = function(fn)
                {
                    fn.apply(self, status, result);
                }
            }
        },

        notify: function(status)
        {
            return this.deliver(undefined, status);
        },

        fn: function()
        {
            return this.deliver.bind(this);
        }
    };
    
    //////////////////////////////////////////////////////////////////////////
    
    var setup = AQT.setup = new Promise();

    document.addEventListener('DOMContentLoaded', 
                              function() { setup.deliver(aqt); });

    //////////////////////////////////////////////////////////////////////////

    var nextContextID = 0;
    var contexts = { };
    var context = AQT.context = function context(base)
    {
        return base === undefined ? new Context() : base.$new();
    }
    var Context = AQT.Context = function AQTContext()
    {
        this.$root = this;
    };
    Context.prototype = 
    {
        $prefix: '/',
        $domain: function(name)
        {
            return {
                __proto__: this, 
                $context: this.$context,
                $prefix: this.$prefix + name + '/'
            };
        },
        $new: function()
        {
            var ctx = Object.create(this);
            ctx.$parent = this;
            return ctx;
        },
        $private: function(n)
        {
            return Object.create(this);
        },
        $path: function(path)
        {
            return {
                __proto__: this, 
                $context: this.$context,
                $prefix: this.$prefix + path.replace(/-/g, '/') + '/'
            };
        },
        $install: function(name, service, config)
        {
            var domain = this.$domain(name);
            var l = arguments.length;
            var install = service.service,
                install = install === undefined ? service : install;
            this[name] = install.call(this, config === undefined ? {} : config);
            var svcname = service.name;
            if (svcname)
            {
                this[svcname] = this[name];
            }
            return this;
        },
        $set: function(name, value)
        {
            if (arguments.length == 2)
            {
                this.$context[this.$prefix + name] = value;
                return this;
            }
            else
            {
                // Name is actually the value, but set on the current
                // domain.
                this.$context[this.$prefix] = name;
                return name;
            }
        },
        $default: function()
        {
            if (arguments.length == 1)
            {
                var value;
                if ((value = this.$get()) === undefined)
                {
                    value = this.$set(this.arguments[0]);
                }
                return value;
            }
            else
            {
                if (this.$get(arguments[0]) === undefined)
                {
                    this.$set.apply(this, arguments);
                }
                return this;
            }
        },
        $var: function(name, value)
        {
            Object.defineProperty(this, name,
            {
                get: function() { return this.$get(name) },
                set: function(value) { return this.$set(name, value); }
            });
            if (value !== undefined)
            {
                this.$default(name, value);
            }
            return this;
        },
        $get: function(name)
        {
            return this.$context[name === undefined 
                                 ? this.$prefix 
                                 : this.$prefix + name];
        },
        $expr: function(expr)
        {
            var context = this;
            expr = expr.replace(/(^\.|[^a-zA-Z0-9_]\.)/g, 'this.');
            var evaluator = eval('(function(){return ' + expr + '})');
            return function() { return evaluator.call(context); };
        }
    };
    Object.defineProperty(Context.prototype, '$context', 
                          { get: function() { return this; } });

    //////////////////////////////////////////////////////////////////////////

    Context.prototype.$make = function(spec, src)
    {
        var xform = this.$transform.$get(spec);
        if (xform === undefined)
        {
            throw 'Cannot find transform "' + spec + '".';
        }
        else
        {
            var value = src === undefined ? this.$get() : src;
            var result = xform.call(this, value);
            return result === undefined 
                              ? value 
                              : src === undefined ? this.$set(result) : result;
        }
    };
    Object.defineProperty(
        Context.prototype, '$transform',
        { get: function() { return this.$context.$domain('$transform'); } }
    );

    //////////////////////////////////////////////////////////////////////////
   
    Context.prototype['/$transform/$service'] = function $service(spec)
    {
        var context = this;
        var thissvc = { $promise: new Promise() };
        this.$import(spec,
        function(service)
        {
            var promise = service.call(thissvc, context);
            if (promise === undefined)
            {
                thissvc.$promise.fn();
            }
            else
            {
                promise.then(thissvc.$promise.fn());
            }
        });
        return thissvc;
    };

    //////////////////////////////////////////////////////////////////////////
   
    var urlparse = AQT.urlparse = Context.prototype['/$transform/$urlparse'] = 
    function $urlparse(src)
    {
        var m = src.match(URL_RE);
        if (m !== null)
        {
            return {
                url: m[0],
                scheme: m[1],
                netloc: m[2],
                path: m[3],
                querystring: m[4],
                fragment: m[5]
            };
        }
    };
    var urlpathparse = AQT.urlpathparse
        = Context.prototype['/$transform/$urlpathparse'] =
    function $urlpathparse(src)
    {
        src = typeof src === 'string' ? urlparse(src) : src;
        var parts = src.pathparts = src.path.split('/');
        while(parts.length && !parts[0])
        {
            parts.shift();
        }
        return src;
    };
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

    var urlbuild = AQT.urlbuild = Context.prototype['/$transform/$urlbuild'] =
    function $urlbuild(src)
    {
        var scheme = src.scheme;
        var netloc = src.netloc;
        var path = src.path;
        var query = src.querystring;
        var fragment = src.fragment;
        var parts = [];

        if (path === undefined && src.pathparts !== undefined)
        {
            path = src.pathparts.join('/');
        }

        if (scheme || netloc)
        {
            parts.push((scheme || this.default_scheme || 'aqt'), '://',
                       (netloc || ''));

            if (path !== undefined)
            {
                parts.push(path.substring(0, 1) == '/' ? path : '/' + path);
            }
        }
        else if (path !== undefined)
        {
            parts.push(path);
        }

        if (query !== undefined)
        {
            parts.push('?', query);
        }

        if (fragment !== undefined)
        {
            parts.push('#', fragment);
        }

        return parts.join('')
    }
   
    //////////////////////////////////////////////////////////////////////////
   
    var modules = {}
    var module = AQT.module = function module(uri, loader)
    {
        if (loader === undefined)
        {
            return modules[uri];
        }
        else
        {
            var module = modules[uri];
            if (module === undefined)
            {
                module = modules[uri] = new Module(uri);
            }

            if (typeof loader === 'string')
            {
                module.$loader = 
                function scriptloader(context)
                {
                    var element = document.createElement('script');
                    var promise = new Promise();
                    element.src = loader;
                    element.type = 'text/javascript';
                    element.onload = function()
                    {
                        promise.deliver(uri);
                    }
                    document.head.appendChild(element);
                    return promise;
                };
            }
            else
            {
                module.$initfn = loader;
            }

            return module;
        }
    }

    var Module = AQT.Module = function AQTModule(modid)
    {
        this.$id = modid;
        this.$ready = new Promise();
    }
    Module.prototype =
    {
        $initfn: function()
        {
            throw "Module did not define an $initfn";
        },
        $init: function()
        {
            // Make any future calls to $load come here and any future
            // $init calls do nothing.
            delete this.$loader;
            this.$init = function() { return this.$ready; }

            // Handle promises from the initfn.
            var promise = this.$initfn();
            if (promise === undefined)
            {
                this.$ready.deliver(this);
            }
            else
            {
                promise.then(function()
                {
                    this.$ready.deliver(this);
                });
            }
            return this.$ready;
        },
        $loader: function()
        {
        },
        $load: function()
        {
            var module = this;
            var promise = this.$loader.call(this);
            if (promise === undefined)
            {
                this.$init();
            }
            else
            {
                promise.then(function() { module.$init(); });
            }
            return this.$ready;
        }
    };

    Context.prototype.$import = function()
    {
        var context = this;
        var waiting = 0;
        var result = [];
        var imports = [];
        var nargs = arguments.length;
        var promise = new Promise();
        for (var i = 0; i < nargs; ++i)
        {
            var arg = arguments[i];
            if (typeof arg === 'string')
            {
                imports.push(arg);
                result.push(undefined);
                waiting++;
            }
            else if (typeof arg === 'function')
            {
                var fn = arg;
                promise.then(function(result) { fn.apply(context, result); });
            }
        }

        if (waiting)
        {
            for (var i = 0; i < waiting; ++i)
            {
                (function(importno, src)
                {
                    if (src.scheme == 'aqt')
                    {
                        var modid = urlbuild(
                        {
                            scheme: 'aqt',
                            netloc: src.netloc,
                            pathparts: [ src.pathparts[0] ]
                        })
                        var mod = module(modid);
                        var name = src.pathparts[1];
                        if (mod === undefined)
                        {
                            throw 'No module for ' + arg;
                        }
                        else
                        {
                            mod.$load().then(
                            function(mod)
                            {
                                result[modid] = result[importno]
                                              = name === undefined 
                                                ? mod : mod[name];
                                if (! --waiting)
                                {
                                    promise.deliver(result, result);
                                }
                                else
                                {
                                    promise.notify(result);
                                }
                            });
                        }
                    }
                    else
                    {
                        throw "Invalid module URL " + arg;
                    }
                })(i, urlpathparse(imports[i]));
            }
        }
        else
        {
            promise.deliver(result);
        }

        return promise;
    }

    setup.then(
    AQT.scanscript = function(aqt)
    {
        var scripts = document.scripts;
        var l = scripts.length;
        for (var i = 0; i < l; ++i)
        {
            var script = scripts[i];
            if (script.type == 'aqt')
            {
                module(script.id, script.getAttribute('href'));
            }
        }
    })

    //////////////////////////////////////////////////////////////////////////

    setup.then(
    AQT.insertwatcher = function(aqt)
    {
        document.addEventListener('DOMNodeInserted',
        function()
        {
            aqt.install.call(event.target, '[aqt],[aqt\\:]');
        });
    },
    AQT.removewatcher = function(aqt)
    {
        document.addEventListener('DOMNodeRemoved',
        function()
        {
            aqt.uninstall(event.target);
        })
    });

    var uninstall = AQT.uninstall = function uninstall(node)
    {
        var ctxid = node.getAttribute('aqt');
        var context = contexts[ctxid];

        if (ctxid && context !== undefined && !context.$locked)
        {
            //console.log('Removing', node, 'context id', ctxid);
            node.setAttribute('aqt', '');
            delete contexts[ctxid];
        }

        var children = node.children;
        var l = children.length;
        for (var i = 0; i < l; ++i)
        {
            uninstall(children[i]);
        }
    };

    //////////////////////////////////////////////////////////////////////////
    
    setup.then(
        AQT.autoelements = function autoelements(aqt)
        {
            aqt.install('[aqt],[aqt\\:]');
        }
    ); 

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    
    var benchmark = AQT.benchmark = function(fn, args, maxsecs, reps, minms)
    {
        reps = reps === undefined ? 1 : reps;
        maxsecs = maxsecs === undefined ? 4 : maxsecs;
        var maxms = parseInt(maxsecs * 1000);
        var now = Date.now();
        var overhead, oreps = reps;
        minms = minms === undefined ? 10 : minms;
        args = args === undefined ? [] : args instanceof Array ? args : [args];
        console.log("Benchmarking", reps, "with", maxsecs, "max seconds");
        var dummy = function() {}
        while(oreps-- && ((overhead = (Date.now() - now)) < maxms))
        {
            dummy.apply(this, args);
        }
        if (overhead >= maxms)
        {
            console.log("Overhead > max time, bailing.")
            return
        }
        now = Date.now();
        var timed, rreps = reps;
        while(rreps-- && ((timed = (Date.now() - now)) < maxms))
        {
            fn.apply(this, args);
        }
        var delta = timed - overhead;
        reps -= rreps;
        if (delta >= minms)
        {
            console.log(reps, "reps in", timed, "ms is", 
                        delta / reps, "ms per rep, and",
                        1000 / (delta / reps), "reps per sec");
        }

        if (timed * 2 < maxms)
        {
            benchmark(fn, args, maxsecs, reps * 2);
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
    
    //AQT.contexts = contexts;
   
    return aqt
})()

