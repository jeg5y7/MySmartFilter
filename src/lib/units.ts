/** Sensors report Celsius; US customers read Fahrenheit. Convert at display. */
export const cToF = (celsius: number): number => (celsius * 9) / 5 + 32;
