#include <metal_stdlib>
using namespace metal;

static inline float luma(float3 rgb) {
    return dot(rgb, float3(0.2126, 0.7152, 0.0722));
}

kernel void msp_teal_orange_grade(texture2d<float, access::read> inTexture [[texture(0)]],
                                  texture2d<float, access::write> outTexture [[texture(1)]],
                                  uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    float4 src = inTexture.read(gid);
    float y = luma(src.rgb);
    float shadowMask = smoothstep(0.55, 0.15, y);
    float highlightMask = smoothstep(0.45, 0.95, y);

    float3 teal = float3(0.00, 0.12, 0.10);
    float3 orange = float3(0.13, 0.06, 0.00);

    float3 graded = src.rgb + teal * shadowMask + orange * highlightMask;
    graded = mix(float3(luma(graded)), graded, 1.08);

    outTexture.write(float4(clamp(graded, 0.0, 1.0), src.a), gid);
}
