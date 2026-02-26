#include <metal_stdlib>
using namespace metal;

static inline float luma(float3 rgb) {
    return dot(rgb, float3(0.2126, 0.7152, 0.0722));
}

kernel void msp_cinematic_fade(texture2d<float, access::read> inTexture [[texture(0)]],
                               texture2d<float, access::write> outTexture [[texture(1)]],
                               uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    float4 src = inTexture.read(gid);
    float y = luma(src.rgb);
    float fade = smoothstep(0.0, 0.8, y);

    float3 lifted = mix(src.rgb, float3(0.08), 0.14 * (1.0 - fade));
    float3 graded = mix(float3(luma(lifted)), lifted, 0.9);
    graded = pow(clamp(graded, 0.0, 1.0), float3(0.95));

    outTexture.write(float4(clamp(graded, 0.0, 1.0), src.a), gid);
}
