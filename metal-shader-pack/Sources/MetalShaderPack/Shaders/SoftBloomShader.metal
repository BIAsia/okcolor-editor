#include <metal_stdlib>
using namespace metal;

static inline float luma(float3 rgb) {
    return dot(rgb, float3(0.2126, 0.7152, 0.0722));
}

kernel void msp_soft_bloom(texture2d<float, access::read> inTexture [[texture(0)]],
                           texture2d<float, access::write> outTexture [[texture(1)]],
                           uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    constexpr sampler s(coord::pixel, address::clamp_to_edge, filter::linear);
    float2 uv = float2(gid) + 0.5;

    float3 base = inTexture.sample(s, uv).rgb;
    float3 blur = float3(0.0);
    const int radius = 2;
    float weightSum = 0.0;

    for (int y = -radius; y <= radius; ++y) {
        for (int x = -radius; x <= radius; ++x) {
            float dist = length(float2(x, y));
            float w = exp(-(dist * dist) / 4.0);
            blur += inTexture.sample(s, uv + float2(x, y)).rgb * w;
            weightSum += w;
        }
    }

    blur /= max(weightSum, 0.0001);
    float bloomMask = smoothstep(0.62, 1.0, luma(base));
    float3 outColor = mix(base, base + blur * 0.35, bloomMask);

    outTexture.write(float4(clamp(outColor, 0.0, 1.0), inTexture.read(gid).a), gid);
}
