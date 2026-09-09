import { IndustrialIntentEngine } from "../ai/core/industrial_intent_engine.js";

console.log("=================================================================");
console.log("  MYCA JS S1-S17 MANDATORY SECURITY TEST SUITE (INDEPENDENT)     ");
console.log("=================================================================\n");

const engine = new IndustrialIntentEngine();
let pass = 0;
let total = 0;

function check(id, name, cond) {
  total++;
  if (cond) {
    pass++;
    console.log(`  [PASS] ${id.padEnd(4)}: ${name}`);
  } else {
    console.log(`  [FAIL] ${id.padEnd(4)}: ${name}`);
  }
}

// S1: close the valve -> VALVE STOP/CLOSE, value 0x0000
const r1 = engine.parseCommand("close the valve");
check("S1", "close the valve -> VALVE CLOSE (value 0x0000)", r1.success && r1.entity === "VALVE" && r1.action === "STOP" && r1.value === 0);

// S2: vana kapat -> VALVE CLOSE, value 0x0000
const r2 = engine.parseCommand("vana kapat");
check("S2", "vana kapat -> VALVE CLOSE (value 0x0000)", r2.success && r2.entity === "VALVE" && r2.action === "STOP" && r2.value === 0);

// S3: pompa nedir acaba -> REJECT (No action frame)
const r3 = engine.parseCommand("pompa nedir acaba");
check("S3", "pompa nedir acaba -> REJECT (No frame)", !r3.success && !r3.frame);

// S4: pompa 2 dur -> PUMP STOP unit=2, value 0x0000
const r4 = engine.parseCommand("pompa 2 dur");
check("S4", "pompa 2 dur -> PUMP STOP unit=2", r4.success && r4.entity === "PUMP" && r4.equipmentNumber === 2 && r4.action === "STOP" && r4.value === 0);

// S5: sakın vanayı açma -> NEGATION_GUARD
const r5 = engine.parseCommand("sakın vanayı açma");
check("S5", "sakın vanayı açma -> NEGATION_GUARD", !r5.success && !r5.frame && (r5.error === "COMMAND_REJECTED_NEGATION" || r5.error === "NEGATION_DETECTED"));

// S6: Start Turbine #12 -> unit=12 (Exact number)
const r6 = engine.parseCommand("Start Turbine #12");
check("S6", "Start Turbine #12 -> unit=12 (Exact number)", r6.success && r6.entity === "TURBINE" && r6.equipmentNumber === 12);

// S7: Start Turbine #3 -> TURBINE START unit=3
const r7 = engine.parseCommand("Start Turbine #3");
check("S7", "Start Turbine #3 -> TURBINE START unit=3", r7.success && r7.entity === "TURBINE" && r7.equipmentNumber === 3);

// S8: Start Turbine #2 -> CRC matches 01 05 00 82 FF 00 -> 2C 12
const r8 = engine.parseCommand("Start Turbine #2");
const s8Pass = r8.success && r8.frame && r8.frame[r8.frame.length - 2] === 0x2C && r8.frame[r8.frame.length - 1] === 0x12;
check("S8", "Start Turbine #2 -> CRC matches 2C 12", s8Pass);

// S9: 2. pompayı durdur -> PUMP STOP unit=2
const r9 = engine.parseCommand("2. pompayı durdur");
check("S9", "2. pompayı durdur -> PUMP STOP unit=2", r9.success && r9.entity === "PUMP" && r9.equipmentNumber === 2 && r9.action === "STOP");

// S10: turbin 2 baslat (ASCII folding) -> TURBINE START unit=2
const r10 = engine.parseCommand("turbin 2 baslat");
check("S10", "turbin 2 baslat (ASCII folding) -> TURBINE START unit=2", r10.success && r10.entity === "TURBINE" && r10.equipmentNumber === 2 && r10.action === "START");

// S11: motoru calistir -> MOTOR START
const r11 = engine.parseCommand("motoru calistir");
check("S11", "motoru calistir -> MOTOR START", r11.success && r11.entity === "MOTOR" && r11.action === "START");

// S12: Never open valve 5 -> NEGATION_GUARD
const r12 = engine.parseCommand("Never open valve 5");
check("S12", "Never open valve 5 -> NEGATION_GUARD", !r12.success && !r12.frame && (r12.error === "COMMAND_REJECTED_NEGATION" || r12.error === "NEGATION_DETECTED"));

// S13: 2. pompayı durdur ve tahliye vanasını aç -> REJECT MULTI_TARGET
const r13 = engine.parseCommand("2. pompayı durdur ve tahliye vanasını aç");
check("S13", "pompa + vana (çift hedef) -> REJECT MULTI_TARGET", !r13.success && !r13.frame && (r13.error === "MULTI_TARGET" || r13.error === "CONTRADICTORY_COMMAND" || r13.error === "MULTIPLE_ENTITIES_REJECTED"));

// S14: Empty string & NULL -> Safe Error
const r14 = engine.parseCommand("");
check("S14", "Empty string -> Safe Error", !r14.success && r14.error === "EMPTY_INPUT");

// S15: 199 char string -> safe handling / reject
const longStr = "pompa ".repeat(33);
const r15 = engine.parseCommand(longStr);
check("S15", "199 char string -> Handled safely without crash", typeof r15 === "object");

// S16: Exact 128 char string -> Defined Safe Output
const exact128 = "A".repeat(128);
const r16 = engine.parseCommand(exact128);
check("S16", "Exact 128 char string -> Safe rejection", !r16.success);

// S17: abort turbine start -> NEGATION_GUARD
const r17 = engine.parseCommand("abort turbine start");
check("S17", "abort turbine start -> NEGATION_GUARD", !r17.success && !r17.frame && (r17.error === "COMMAND_REJECTED_NEGATION" || r17.error === "NEGATION_DETECTED"));

console.log("\n-----------------------------------------------------------------");
console.log(`  JS SECURITY MATRIX RESULT: ${pass} / ${total} PASSED`);
console.log("=================================================================\n");

if (pass !== total) {
  process.exit(1);
}
