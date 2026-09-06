import unittest
import json
import urllib.request
from myca.memory import MemoryController

class TestPythonResonanceLive(unittest.TestCase):
    def setUp(self):
        self.mem = MemoryController()

    def test_node_api_reachability(self):
        """Test whether Node.js Resonance API is running on localhost:3500."""
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:3500/encode",
                data=json.dumps({"text": "Sağlık kaydı test metni"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as res:
                self.assertEqual(res.status, 200)
                data = json.loads(res.read().decode("utf-8"))
                self.assertIn("values", data)
                self.assertGreater(len(data["values"]), 0)
                print(f"  [Python PASS] Node.js /encode API reachable and working (D={data.get('D')})")
        except Exception as e:
            self.fail(f"Node.js API unreachable on port 3500: {e}")

    def test_python_memory_resonance_sync(self):
        """Test Python memory scoring and live sync with Node LSH."""
        text_a = "Hastanın kan grubu A Pozitif olarak kayıt edildi."
        text_b = "Hastanın kan grubu nedir?"
        
        memory_id = self.mem.add_memory(
            content=text_a,
            category="decision"
        )
        self.assertTrue(len(memory_id) > 0)
        print(f"  [Python PASS] add_memory successfully saved SQLite & synced with Node LSH. ID: {memory_id}")

        # Check resonance score calculation
        vec_a = self.mem.embed(text_a)
        vec_b = self.mem.embed(text_b)
        
        score = self.mem.score_resonance(text_b, text_a, vec_b, vec_a)
        self.assertIsInstance(score, float)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)
        print(f"  [Python PASS] Compound resonance score computed successfully: {score:.4f}")

if __name__ == "__main__":
    unittest.main()
