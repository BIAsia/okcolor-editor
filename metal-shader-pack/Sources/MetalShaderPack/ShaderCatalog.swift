public enum ShaderCatalog {
    public static let functionByShader: [MSPShader: String] = [
        .mspColorBoost: "msp_color_boost",
        .mspCinematicFade: "msp_cinematic_fade",
        .mspTealOrangeGrade: "msp_teal_orange_grade",
        .mspPastelLift: "msp_pastel_lift",
        .mspSoftBloom: "msp_soft_bloom",
        .mspVignetteFocus: "msp_vignette_focus"
    ]

    public static func functionName(for shader: MSPShader) -> String? {
        functionByShader[shader]
    }
}
