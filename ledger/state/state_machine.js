/**
 * Static Memory World State Machine
 * Updates device actuator states (Coils, Relays, Registers) deterministically.
 */
export class MycWorldState {
  constructor() {
    // Fixed static registry (zero heap allocation simulation)
    this.actuators = {
      "TURBINE_1": { coil: 0x0081, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
      "TURBINE_2": { coil: 0x0082, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
      "VALVE_1":   { coil: 0x0011, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
      "VALVE_5":   { coil: 0x0015, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
      "PUMP_1":    { coil: 0x0001, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
      "MOTOR_1":   { coil: 0x0061, state: 0, relayPinVolt: 0.0, lastUpdated: 0 },
    };
  }

  transition(device, unitNumber, action, actionValue) {
    const key = `${device}_${unitNumber}`;
    if (!this.actuators[key]) {
      this.actuators[key] = { coil: 0x0000, state: 0, relayPinVolt: 0.0, lastUpdated: 0 };
    }

    const isEngaged = action === "START" && actionValue === 0xFF00;
    this.actuators[key].state = actionValue;
    this.actuators[key].relayPinVolt = isEngaged ? 3.30 : 0.00;
    this.actuators[key].lastUpdated = Date.now();

    return this.actuators[key];
  }

  getActuator(device, unitNumber) {
    const key = `${device}_${unitNumber}`;
    return this.actuators[key] || { state: 0, relayPinVolt: 0.00 };
  }
}
