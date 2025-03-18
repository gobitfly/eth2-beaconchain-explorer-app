import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(StorageMirrorPlugin)
public class StorageMirrorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorageMirrorPlugin"
    public let jsName = "StorageMirror"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "reflect", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = StorageMirror()

    @objc func reflect(_ call: CAPPluginCall) {
        let keysToReflect = call.getArray("keys", String.self) ?? []
        implementation.reflect(keysToReflect)
        call.resolve()
    }
}
