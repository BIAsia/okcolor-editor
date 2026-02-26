public enum MSPShader: String, CaseIterable, Sendable {
    case mspColorBoost
    case mspCinematicFade
    case mspTealOrangeGrade
    case mspPastelLift
    case mspSoftBloom
    case mspVignetteFocus
    case mspFilmGrain
    case mspChromaticAberration
    case mspTiltShift
    case mspDuotoneMap
    case mspPixelMosaic
    case mspEdgeGlow
}

public enum MSPRenderQuality: String, Sendable {
    case balanced
    case quality
}

public struct MSPRenderConfig: Sendable {
    public var quality: MSPRenderQuality
    public var frameBudgetMs: Int

    public init(quality: MSPRenderQuality = .balanced, frameBudgetMs: Int = 16) {
        self.quality = quality
        self.frameBudgetMs = frameBudgetMs
    }
}

public struct MSPShaderPipeline: Sendable {
    public private(set) var config: MSPRenderConfig

    public init(config: MSPRenderConfig = .init()) {
        self.config = config
    }

    public mutating func updateConfig(_ config: MSPRenderConfig) {
        self.config = config
    }
}
