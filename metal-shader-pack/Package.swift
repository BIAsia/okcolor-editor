// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "MetalShaderPack",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "MetalShaderPack",
            targets: ["MetalShaderPack"]
        )
    ],
    targets: [
        .target(
            name: "MetalShaderPack",
            path: "Sources/MetalShaderPack",
            resources: [
                .process("Shaders")
            ]
        ),
        .testTarget(
            name: "MetalShaderPackTests",
            dependencies: ["MetalShaderPack"],
            path: "Tests/MetalShaderPackTests"
        )
    ]
)
