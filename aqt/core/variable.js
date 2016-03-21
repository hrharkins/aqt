// aqt/variable.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/variable',
['aqt#AQT', 'aqt#Pipeline', 'aqt://aqt/core/comparator#comparator'],
function(AQT, Pipeline, comparator)
{

    //////////////////////////////////////////////////////////////////////////
    
    var Variable = AQT.Variable = this.Variable = Pipeline.$extend
    (
        function Variable(self, value)
        {
            Pipeline.call(this, self);
            if (value !== undefined)
            {
                this.value = value;
                this.changed = comparator(value);
            }
            return this.fn;
        },

        function $deliver(value, callback, start, initiator)
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

        function $then(fn)
        {
            var value = this.value;
            if (value !== undefined)
            {
                fn.call(this, value);
            }
            return Promise.prototype.$then.apply(this, arguments);
        },

        function $install(what, config)
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

        function $service(what, fn)
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
    );

    /*
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
    */

    //////////////////////////////////////////////////////////////////////////

    var DerivedVariable = Variable.$extend
    (
        function DerivedVariable(source, self, value)
        {
            this.$source = source;
            Variable.call(this, self, value);
        },
        
        function $assign()
        {
            return this.$source.$assign.apply(this.$source, arguments);
        }
    );

});

