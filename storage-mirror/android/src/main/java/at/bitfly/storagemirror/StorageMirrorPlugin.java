package at.bitfly.storagemirror;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StorageMirror")
public class StorageMirrorPlugin extends Plugin {

    @PluginMethod
    public void echo(PluginCall call) {
        call.resolve(new JSObject());
    }
}
