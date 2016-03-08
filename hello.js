
aqt.module('aqt:///HelloMod',
function()
{
    this.GreeterSvc = function(dest)
    {
        dest.$var('who', 'world');
    }
})

