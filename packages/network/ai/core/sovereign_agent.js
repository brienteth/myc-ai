/**
 * Sovereign Autonomous Agent Module
 * Implements a fully local ReAct (Reasoning + Acting) otonom loop 
 * powered by local tools and deterministic task planning.
 */

import { evaluateMath } from './reasoning_router.js';

export class SovereignAgent {
  /**
   * @param {Object} sdkInstance - The ResonanceSDK instance containing hdc, memory, router, morphology
   */
  constructor(sdkInstance) {
    this.sdk = sdkInstance;
    this.memory = sdkInstance ? sdkInstance.memory : null;
    this.morphology = sdkInstance ? sdkInstance.morphology : null;
    this.router = sdkInstance ? sdkInstance.router : null;
    
    // Wire up available otonom tools
    this.tools = {
      memory_lookup: (query) => {
        if (!this.memory) return "Hata: Bellek motoru yüklü değil.";
        const vec = this.router ? this.router.vectorize(query) : new Float32Array(1024);
        const results = this.memory.retrieve(vec, 1);
        if (results.length === 0) return "Bulunamadı.";
        return results[0].record.content;
      },
      math_eval: (expr) => {
        try {
          return evaluateMath(expr).toString();
        } catch (e) {
          return `Hata: Matematiksel hesaplama başarısız. ${e.message}`;
        }
      },
      morphology_analyze: (word) => {
        if (!this.morphology) return "Hata: Morfoloji motoru yüklü değil.";
        const analysis = this.morphology.analyze(word);
        return JSON.stringify({
          root: analysis.root,
          suffixes: analysis.suffixes,
          harmony: analysis.harmony,
          syllables: analysis.syllables
        });
      },
      spectral_transform: (text) => {
        if (!this.sdk || !this.sdk.spectral) return "Hata: Spektral motor yüklü değil.";
        const vec = this.router ? this.router.vectorize(text) : new Float32Array(1024);
        const spec = this.sdk.spectral.spectralTransform({ type: 'real', values: vec, D: vec.length });
        return `Energy: ${spec.magnitude.reduce((a, b) => a + b, 0).toFixed(2)}`;
      },
      system_time: () => {
        return new Date().toISOString();
      }
    };
  }

  /**
   * Run the ReAct autonomous execution loop
   * @param {string} goal - The user prompt/objective
   * @param {number} [maxSteps=5] - Maximum execution steps
   * @returns {Promise<Object>} Execution log and final answer
   */
  async execute(goal, maxSteps = 5) {
    const logs = [];
    let step = 1;
    let finished = false;
    let finalAnswer = "";

    // Local planner parsing key intents from query
    const lowerGoal = goal.toLowerCase();

    while (step <= maxSteps && !finished) {
      let thought = "";
      let action = "";
      let actionArg = "";

      // Step-by-step reasoning path determined based on goal context
      if (lowerGoal.includes("hatırla") || lowerGoal.includes("hafıza") || lowerGoal.includes("favori")) {
        if (step === 1) {
          thought = "Kullanıcının sorduğu favori veya bellek kaydını bulmak için hafızada arama yapmalıyım.";
          action = "memory_lookup";
          // extract likely key query
          actionArg = lowerGoal.includes("renk") ? "favori renk" : "hafıza sorgusu";
        } else if (step === 2) {
          const prevObs = logs[0].observation;
          thought = `Hafızadan '${prevObs}' bilgisini aldım. Bu kelimeyi morfolojik olarak analiz etmeliyim.`;
          action = "morphology_analyze";
          actionArg = prevObs.split(/\s+/).pop().replace(/[^a-zçgğıoöşuüâîû]/g, '');
        } else {
          const prevObs = logs[1].observation;
          thought = "Gerekli aramaları ve analizleri tamamladım. Sonucu kullanıcıya sunuyorum.";
          finished = true;
          finalAnswer = `Otonom ReAct Görevi Başarıyla Tamamlandı.\n` + 
                      `- Hafıza Kaydı: ${logs[0].observation}\n` +
                      `- Morfolojik Yapı: ${prevObs}`;
        }
      } else if (lowerGoal.includes("hesapla") || /[0-9+\-*/%^]/.test(lowerGoal)) {
        if (step === 1) {
          thought = "Matematiksel ifadeyi deterministik parser ile hesaplamalıyım.";
          action = "math_eval";
          // extract arithmetic expression
          const match = goal.match(/[0-9+\-*/%^().\s]+/);
          actionArg = match ? match[0].trim() : "0";
        } else if (step === 2) {
          const val = logs[0].observation;
          thought = `Hesaplanan '${val}' sonucunun spektral enerji yoğunluğunu kontrol etmeliyim.`;
          action = "spectral_transform";
          actionArg = val;
        } else {
          thought = "Hesaplama ve spektral dönüşüm adımları bitti. Sonucu dönüyorum.";
          finished = true;
          finalAnswer = `Hesaplama Sonucu: ${logs[0].observation} | Spektral Temsiliyet: ${logs[1].observation}`;
        }
      } else {
        // Generic default task path
        if (step === 1) {
          thought = "Sistem saatini alarak güncel zamanı kontrol etmeliyim.";
          action = "system_time";
          actionArg = "";
        } else {
          thought = "Varsayılan otonom akış tamamlandı.";
          finished = true;
          finalAnswer = `Mevcut Zaman Dilimi: ${logs[0].observation}`;
        }
      }

      if (!finished) {
        // Execute tool action
        let observation = "";
        const toolFn = this.tools[action];
        if (toolFn) {
          observation = toolFn(actionArg);
        } else {
          observation = `Hata: '${action}' aracı tanımlı değil.`;
        }

        logs.push({
          step,
          thought,
          action,
          argument: actionArg,
          observation
        });
        
        step++;
      } else {
        logs.push({
          step,
          thought,
          action: "final_answer",
          argument: "",
          observation: finalAnswer
        });
      }
    }

    return {
      goal,
      stepsRun: step - 1,
      logs,
      finalAnswer
    };
  }
}
