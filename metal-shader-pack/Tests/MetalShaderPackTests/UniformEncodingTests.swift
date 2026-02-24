import XCTest
@testable import MetalShaderPack

final class UniformEncodingTests: XCTestCase {
    func testDefaultIntensityRange() {
        XCTAssertGreaterThanOrEqual(MSPUniformDefaults.defaultIntensity, 0.0)
        XCTAssertLessThanOrEqual(MSPUniformDefaults.defaultIntensity, 1.0)
    }
}
