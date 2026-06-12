// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "StorageMirror",
    platforms: [.iOS(.v13)],
    products: [
        .library(
            name: "StorageMirror",
            targets: ["StorageMirrorPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", branch: "main")
    ],
    targets: [
        .target(
            name: "StorageMirrorPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/StorageMirrorPlugin"),
        .testTarget(
            name: "StorageMirrorPluginTests",
            dependencies: ["StorageMirrorPlugin"],
            path: "ios/Tests/StorageMirrorPluginTests")
    ]
)