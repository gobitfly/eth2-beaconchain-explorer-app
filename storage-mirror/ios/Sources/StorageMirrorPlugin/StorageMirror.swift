import Foundation

@objc public class StorageMirror: NSObject {
    let defaults = UserDefaults.standard
    let shared = UserDefaults(suiteName: "group.in.beaconcha.mobile2")
    
    @objc public func reflect(_ value: Array<String>) -> Void {
        value.forEach { key in
            let value = defaults.string(forKey: key) ?? ""
            shared?.set(value, forKey: key)
        }
        return
    }
}
