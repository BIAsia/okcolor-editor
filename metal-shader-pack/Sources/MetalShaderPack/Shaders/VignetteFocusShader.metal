#include <metal_stdlib>
using namespace metal;

kernel void msp_vignette_focus(texture2d<float, access::read> inTexture [[texture(0)]],
                               texture2d<float, access::write> outTexture [[texture(1)]],
                               uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    float2 size = float2(outTexture.get_width(), outTexture.get_height());
    float2 uv = (float2(gid) + 0.5) / size;
    float2 centered = uv - 0.5;
    centered.x *= size.x / max(size.y, 1.0);

    float dist = length(centered);
    float vignette = smoothstep(0.35, 0.78, dist);

    float4 src = inTexture.read(gid);
    float3 focused = src.rgb * (1.0 - vignette * 0.45);
    outTexture.write(float4(clamp(focused, 0.0, 1.0), src.a), gid);
}
