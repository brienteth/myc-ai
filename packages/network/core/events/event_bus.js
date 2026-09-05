import { EventEmitter } from "events";

/**
 * MYCA Central Event Bus (Singleton)
 * 
 * Provides unified pub/sub across all blockchain subsystems:
 * - Smart contract logs & events (`contract:*:EventName`, `contract:0x...:Transfer`)
 * - Block lifecycle (`block:finalized`, `block:proposed`)
 * - Transactions (`tx:confirmed`, `tx:failed`)
 * - DePIN device events (`device:registered`, `device:telemetry`, `device:actuated`)
 * - Colony runtime (`colony:task:scheduled`, `colony:task:settled`, `colony:capability:registered`)
 */
class MycEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this.eventHistory = [];
    this.maxHistory = 200;
  }

  emitEvent(topic, payload = {}) {
    const timestamp = Date.now();
    const eventRecord = { topic, payload, timestamp };

    // Record in memory ring buffer
    this.eventHistory.push(eventRecord);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Emit exact topic
    this.emit(topic, eventRecord);

    // Emit wildcard topic if segmented by colon (e.g. contract:address:Event -> contract:*:Event)
    if (topic.includes(":")) {
      const parts = topic.split(":");
      if (parts.length === 3) {
        const wildcardTopic = `${parts[0]}:*:${parts[2]}`;
        this.emit(wildcardTopic, eventRecord);
      }
      const topLevelTopic = `${parts[0]}:*`;
      this.emit(topLevelTopic, eventRecord);
    }

    // Emit global catch-all
    this.emit("*", eventRecord);

    return eventRecord;
  }

  getRecentEvents(topicFilter = null, limit = 50) {
    if (!topicFilter) {
      return this.eventHistory.slice(-limit);
    }
    return this.eventHistory
      .filter(e => e.topic === topicFilter || (topicFilter.endsWith("*") && e.topic.startsWith(topicFilter.slice(0, -1))))
      .slice(-limit);
  }
}

export const globalEventBus = new MycEventBus();
