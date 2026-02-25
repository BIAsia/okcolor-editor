import XCTest
@testable import MetalShaderPack

final class ShaderCatalogTests: XCTestCase {
    func testFirstSixFunctionNamesUnique() {
        let names = ShaderCatalog.functionByShader.values
        XCTAssertEqual(Set(names).count, names.count)
        XCTAssertEqual(names.count, 6)
    }

    func testCatalogContainsFirstSixLockedShaders() {
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspColorBoost), "msp_color_boost")
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspCinematicFade), "msp_cinematic_fade")
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspTealOrangeGrade), "msp_teal_orange_grade")
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspPastelLift), "msp_pastel_lift")
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspSoftBloom), "msp_soft_bloom")
        XCTAssertEqual(ShaderCatalog.functionName(for: .mspVignetteFocus), "msp_vignette_focus")
    }

    func testPreviewCatalogCoversFirstSixOnly() {
        XCTAssertEqual(MSPPreviewCatalog.firstSix.count, 6)

        for preset in MSPPreviewCatalog.firstSix {
            XCTAssertNotNil(ShaderCatalog.functionName(for: preset.shader))
            XCTAssertFalse(preset.displayName.isEmpty)
            XCTAssertFalse(preset.subtitle.isEmpty)
        }

        XCTAssertNil(MSPPreviewCatalog.preview(for: .mspFilmGrain))
        XCTAssertNil(MSPPreviewCatalog.preview(for: .mspEdgeGlow))
    }
}
