#include <metal_stdlib>
using namespace metal;

kernel void msp_pastel_lift(texture2d<float, access::read> inTexture [[texture(0)]],
                            texture2d<float, access::write> outTexture [[texture(1)]],
                            uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= outTexture.get_width() || gid.y >= outTexture.get_height()) {
        return;
    }

    float4 src = inTexture.read(gid);
    float3 washed = mix(src.rgb, float3(1.0), 0.12);
    float mid = (washed.r + washed.g + washed.b) / 3.0;
    float3 pastel = mix(float3(mid), washed, 0.82);

    outTexture.write(float4(clamp(pastel, 0.0, 1.0), src.a), gid);
}
