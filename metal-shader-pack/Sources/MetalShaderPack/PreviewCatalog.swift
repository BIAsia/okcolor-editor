public struct MSPPreviewPreset: Sendable, Equatable {
    public let shader: MSPShader
    public let displayName: String
    public let subtitle: String

    public init(shader: MSPShader, displayName: String, subtitle: String) {
        self.shader = shader
        self.displayName = displayName
        self.subtitle = subtitle
    }
}

public enum MSPPreviewCatalog {
    public static let firstSix: [MSPPreviewPreset] = [
        .init(
            shader: .mspColorBoost,
            displayName: "Color Boost",
            subtitle: "Punchier contrast and saturation"
        ),
        .init(
            shader: .mspCinematicFade,
            displayName: "Cinematic Fade",
            subtitle: "Lifted blacks with softer highlights"
        ),
        .init(
            shader: .mspTealOrangeGrade,
            displayName: "Teal/Orange Grade",
            subtitle: "Cool shadows and warm highlights"
        ),
        .init(
            shader: .mspPastelLift,
            displayName: "Pastel Lift",
            subtitle: "Airy tones with gentle desaturation"
        ),
        .init(
            shader: .mspSoftBloom,
            displayName: "Soft Bloom",
            subtitle: "Glowing highlights and diffusion"
        ),
        .init(
            shader: .mspVignetteFocus,
            displayName: "Vignette Focus",
            subtitle: "Center emphasis with edge darkening"
        )
    ]

    public static func preview(for shader: MSPShader) -> MSPPreviewPreset? {
        firstSix.first { $0.shader == shader }
    }
}
