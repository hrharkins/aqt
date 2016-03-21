// aqt/request.js
// Copyright (c) 2016 Rich Harkins.  All Rights Reserved.

aqt.module('aqt://aqt/core/request',
['aqt#AQT', 'aqt#Pipeline']
(function(AQT, Pipeline)
{

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
  
    var Request = AQT.Request = function Request(options)
    {
        var xhr = this.xhr = new XMLHttpRequest();
        Pipeline.call(this, xhr);
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

})(aqt.__proto__)


