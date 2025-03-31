//
//  StorageMirror.swift
//  App
//
//  Created by Kai Pflaume on 28.04.21.
//

import Foundation
import Capacitor

@objc(StorageMirror)
public class StorageMirror: CAPPlugin {
    
    let defaults = UserDefaults.standard
    let shared = UserDefaults(suiteName: "group.in.beaconcha.mobile2")
    
    @objc func reflect(_ call: CAPPluginCall) {
        let keysToReflect = call.getArray("keys", String.self) ?? []
        keysToReflect.forEach { key in
            let value = defaults.string(forKey: key) ?? ""
            shared?.set(value, forKey: key)
        }
    }
}
