#include <metal_stdlib>
using namespace metal;

static inline float luma(float3 rgb) {
    return dot(rgb, float3(0.2126, 0.7152, 0.0722));
}

kernel void msp_color_boost(texture2d<float, access::read> inTexture [[texture(0)]],
                            texture2d<float, access::write> outTexture [[texture(1)]],
                            uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    float4 src = inTexture.read(gid);
    float y = luma(src.rgb);
    float3 boosted = mix(float3(y), src.rgb, 1.22);
    boosted = (boosted - 0.5) * 1.08 + 0.5;
    outTexture.write(float4(clamp(boosted, 0.0, 1.0), src.a), gid);
}
