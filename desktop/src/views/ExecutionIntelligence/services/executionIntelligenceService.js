import axios from 'axios';

const API_BASE_URL = 'http://localhost:8420/execution/intelligence';

class ExecutionIntelligenceService {
  /**
   * Plans the execution, returns intent contract, agents, graph structure
   */
  async planExecution(intent) {
    try {
      const response = await axios.post(`${API_BASE_URL}/plan`, { intent });
      return response.data;
    } catch (error) {
      console.error("Error planning execution:", error);
      throw error;
    }
  }

  /**
   * Simulates the execution without side effects
   */
  async simulateExecution(intent) {
    try {
      const response = await axios.post(`${API_BASE_URL}/simulate`, { intent });
      return response.data;
    } catch (error) {
      console.error("Error simulating execution:", error);
      throw error;
    }
  }

  /**
   * Runs the execution
   */
  async runExecution(intent) {
    try {
      const response = await axios.post(`${API_BASE_URL}/run`, { intent });
      return response.data;
    } catch (error) {
      console.error("Error running execution:", error);
      throw error;
    }
  }

  /**
   * Gets a specific execution status
   */
  async getExecution(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/executions/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching execution:", error);
      throw error;
    }
  }

  /**
   * Pauses an execution
   */
  async pauseExecution(id) {
    try {
      const response = await axios.post(`${API_BASE_URL}/executions/${id}/pause`);
      return response.data;
    } catch (error) {
      console.error("Error pausing execution:", error);
      throw error;
    }
  }

  /**
   * Resumes an execution
   */
  async resumeExecution(id) {
    try {
      const response = await axios.post(`${API_BASE_URL}/executions/${id}/resume`);
      return response.data;
    } catch (error) {
      console.error("Error resuming execution:", error);
      throw error;
    }
  }
}

export default new ExecutionIntelligenceService();
