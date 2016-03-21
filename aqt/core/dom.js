// aqt/dom.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/dom',
['aqt#AQT', 'aqt://aqt/core/context#context'],
function AQTDomModule(AQT, context)
{

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
    
    var lookup = AQT.lookup = function lookup(obj, into)
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

});

