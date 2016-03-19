
aqt.module('aqt:///HelloMod',
function()
{
    this.GreeterSvc = function(dest)
    {
        dest.$define('who', 'world');
    }
})

