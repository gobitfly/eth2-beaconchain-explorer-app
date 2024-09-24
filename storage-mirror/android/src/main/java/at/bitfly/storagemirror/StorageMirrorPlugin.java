package at.bitfly.storagemirror;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StorageMirror")
public class StorageMirrorPlugin extends Plugin {

    private StorageMirror implementation = new StorageMirror();

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("keys");

        JSObject ret = new JSObject();
        ret.put("value", implementation.echo(value));
        call.resolve(ret);
    }
}
