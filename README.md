# Práctica 04: Animación y Simulación de Crecimiento Botánico

* **Materia:** Bioinformatica y Biologia Computacional Avanzados
* **Estudiantes:** Victoria Angélica Galarza Pérez y Fernando José Alexander Cruz Castro

---

## Descripción del Proyecto
Este proyecto implementa un **Simulador Educativo y Laboratorio de Crecimiento Vegetal en Tiempo Real** desarrollado con **Three.js** y **GLSL Shaders Custom**. Representa el ciclo morfogenético de tres especímenes de azucena (*Lilium candidum*), desde la etapa germinal (0%) hasta la floración completa (100%), permitiendo controlar dinámicamente factores ambientales como la velocidad biológica de desarrollo y la turbulencia del viento.

---

## Cuestionario de Entrega (Classroom)

### 1. ¿Qué tema representa tu simulador de crecimiento?
Representa un **Laboratorio de Biotecnología y Fisiología Vegetal** en el que se monitorea el desarrollo ontogénico de tres especímenes en condiciones controladas, analizando la tasa de crecimiento foliar y la respuesta mecánico-estructural ante corrientes de viento.

### 2. ¿Cómo implementaste el bucle de animación con `requestAnimationFrame`?
Mediante la función recursiva `animate()` ejecutada aproximadamente 60 veces por segundo. En cada cuadro se calcula el tiempo delta con `THREE.Clock`, el cual incrementa la variable acumulativa `globalGrowthProgress` e incrementa la variable `uTime` transmitida al Vertex Shader para refrescar la ondulación continua.

### 3. ¿Cómo animaste el crecimiento de la planta? (Escala, posición, rotación)
Utilizamos un sistema de **propagación por umbrales**:
* **Tallo:** Escala principalmente en el eje $Y$ de $0$ a $1$ en la etapa inicial ($0\%$ a $40\%$).
* **Hojas:** Surgen progresivamente en filotaxis helicoidal escalando de $(0,0,0)$ a $(1,1,1)$ entre el $30\%$ y el $80\%$ usando la función de interpolación suave `THREE.MathUtils.smoothstep`.
* **Flor Apical:** Se desarrolla al final ($75\%$ a $100\%$) desplegando los pétalos.

### 4. ¿Cómo simulaste el viento? ¿Usaste shaders o transformaciones simples?
Implementamos un enfoque mixto:
* **En el Shader (GLSL):** El Vertex Shader (`plant.vert`) desplaza las coordenadas de los vértices en $X$ y $Z$ mediante funciones senoidales en función de la altura local $Y$ y el tiempo `uTime`.
* **En la Jerarquía:** Los tallos articulados mantienen una suave inclinación armada en Javascript.

### 5. ¿Qué controles agregaste para modificar la simulación?
1. Slider de **Velocidad de Crecimiento** ($0.1\text{x}$ a $3.0\text{x}$).
2. Slider de **Intensidad del Viento** ($0.0$ a $3.0$).
3. Botón para **Reiniciar Crecimiento** (vuelve el contador a $0\%$).
4. Botón para **Pausar/Reanudar Simulación**.
5. Botón para alternar **Pigmentación Foliar** (cambia los uniforms de color en el Fragment Shader).
6. Botón para **Reiniciar Cámara**.

### 6. ¿Cómo gestionaste la jerarquía para que el crecimiento se propague?
Estructuramos los objetos en un árbol donde el `stemGroup` es el padre primario. Al escalar el grupo del tallo o las ramas, todos los nodos hijos (hojas y flores) heredan de forma natural la transformación matricial, manteniendo coherencia de posición mientras escalan individualmente.

### 7. ¿Qué shader personalizado usaste y qué efecto produce?
Implementamos un par de shaders GLSL (`ShaderMaterial`):
* **Vertex Shader (`plant.vert`):** Produce la ondulación realista por viento en las hojas aumentando la amplitud proporcionalmente a la distancia de la base.
* **Fragment Shader (`plant.frag`):** Realiza un degradado de color dinámico desde la base fotosintética oscura (`uBaseColor`) hasta el ápice o punta de crecimiento (`uTipColor`).

### 8. ¿Qué parte del proyecto fue la más difícil?
Sincronizar las etapas del crecimiento de forma que las hojas no aparecieran flotando antes de que el tallo alcanzara la altura adecuada, y coordinar los parámetros del `ShaderMaterial` con el bucle de renderizado.

### 9. ¿Cómo podrías mejorar este simulador si lo conectaras después con PHP, FlightPHP y SQLite?
* **SQLite:** Permite almacenar las métricas de desarrollo (tiempo transcurrido, velocidad asignada, porcentaje final) y registrar catálogos botánicos de distintas especies.
* **FlightPHP:** Puede servir endpoints REST API para guardar configuraciones del simulador por usuario y devolver parámetros de crecimiento personalizados para cargar distintas plantas desde la base de datos.