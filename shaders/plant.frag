uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform float uGrowthProgress;
varying vec2 vUv;
varying float vLocalY;

void main() {
    // Mezcla de color base a punta de la hoja
    float factor = clamp(vLocalY * 2.0 + 0.2, 0.0, 1.0);
    vec3 finalColor = mix(uBaseColor, uTipColor, factor);

    // Si el desarrollo aún no alcanza el tejido, oscurece o atenúa levemente
    finalColor *= (0.5 + 0.5 * clamp(uGrowthProgress * 1.5, 0.0, 1.0));

    gl_FragColor = vec4(finalColor, 1.0);
}