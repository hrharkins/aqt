
aqt.module('aqt://site/Hello',
function()
{
    this.GreeterSvc = function(dest)
    {
        dest.$define('who', 'world');
    }
})

